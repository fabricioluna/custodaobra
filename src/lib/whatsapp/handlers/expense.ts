import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveSupplier } from "@/features/suppliers/resolve";
import { loadExtractionContext } from "@/lib/ai/context";
import {
  type ExtractedExpense,
  extractExpense,
} from "@/lib/ai/extract-expense";
import { canUseWhatsappAi } from "@/lib/billing/limits";
import { recordUsage } from "@/lib/billing/usage";
import { addDays, isIsoDate, todayIn } from "@/lib/dates";
import { isValidAmountCents, parseMoneyToCents } from "@/lib/money";
import type { Database } from "@/types/database";

import type { BotAction } from "../actions";
import type { OutgoingMessage } from "../client";
import {
  type Conversation,
  type ConversationState,
  keepPendingSupplier,
  resetConversation,
  saveConversation,
  WHATSAPP_SOURCES,
} from "../conversation";
import {
  botMessages,
  CATEGORY_NAMES,
  categoryListMessage,
  dateListMessage,
  editMenuMessage,
  formatSummary,
  parseAmountReply,
  projectListMessage,
  stageListMessage,
  summaryMessage,
} from "../messages";
import { type LaunchableProject, listLaunchableProjects } from "../projects";
import { sendProjectPage, sendProjectSummary } from "./commands";

type Admin = SupabaseClient<Database>;

/**
 * Uma conversa com uma pessoa já ligada. Roda com service_role: toda leitura
 * e escrita filtra por quem lançou (created_by) e pela conta (org_id).
 */
export type BotSession = {
  admin: Admin;
  userId: string;
  conversation: Conversation;
  send: (message: OutgoingMessage) => Promise<void>;
  /** Anota no log da mensagem por que ela não virou lançamento. */
  noteError?: (code: string) => void;
};

// Mensagem de texto ----------------------------------------------------------------

export async function handleText(
  session: BotSession,
  text: string,
  logId: string | null,
): Promise<void> {
  const { conversation } = session;
  if (conversation.state === "awaiting_amount") {
    const amount = parseAmountReply(text);
    if (amount !== null) {
      const cents = parseMoneyToCents(amount);
      if (cents === null || !isValidAmountCents(cents)) {
        return session.send({ type: "text", body: botMessages.askAmountAgain });
      }
      return applyAmount(session, cents);
    }
    // Não é só um número: é um gasto novo.
  }
  return startExpense(session, text, logId);
}

async function startExpense(
  session: BotSession,
  text: string,
  logId: string | null,
): Promise<void> {
  const { admin, userId, conversation } = session;
  const projects = await listLaunchableProjects(admin, userId);
  if (!projects.length) {
    await resetConversation(admin, userId);
    return session.send({ type: "text", body: botMessages.noProjects });
  }

  let project = projects.find((p) => p.id === conversation.active_project_id);
  if (!project && projects.length === 1) project = projects[0];
  if (!project) {
    const orgCount = new Set(projects.map((p) => p.orgId)).size;
    await Promise.all([
      discardPending(session),
      saveConversation(admin, userId, {
        state: "awaiting_project",
        pendingExpenseId: null,
        context: { pendingText: text, pendingLogId: logId },
      }),
      session.send(projectListMessage(projects, orgCount > 1)),
    ]);
    return;
  }

  // Guardar a obra ativa não muda o que a leitura faz: vai em paralelo (só
  // mexe nas colunas da obra; o estado da conversa é gravado depois da IA).
  await Promise.all([
    project.id === conversation.active_project_id
      ? Promise.resolve()
      : saveConversation(admin, userId, {
          activeOrgId: project.orgId,
          activeProjectId: project.id,
        }).catch((error: unknown) =>
          // Sem a obra ativa gravada, a próxima mensagem só pergunta de novo.
          console.error("[whatsapp] falha ao guardar a obra ativa", error),
        ),
    readExpense(session, project, text, logId),
  ]);
}

/** IA lê a mensagem; o gasto nasce pendente (ou vira rascunho sem valor). */
async function readExpense(
  session: BotSession,
  project: LaunchableProject,
  text: string,
  logId: string | null,
): Promise<void> {
  const { admin, userId } = session;
  const today = todayIn(project.timezone);

  // Limite do plano e contexto da obra ao mesmo tempo.
  const [allowed, context] = await Promise.all([
    canUseWhatsappAi(admin, project.orgId, today),
    loadExtractionContext(admin, project.orgId, project.id, project.timezone),
  ]);
  if (!allowed.ok) {
    session.noteError?.(`limit_${allowed.reason}`);
    const body =
      allowed.reason === "whatsapp_disabled"
        ? botMessages.whatsappDisabled
        : allowed.reason === "max_whatsapp_entries" ||
            allowed.reason === "max_ai_calls"
          ? botMessages.limitReached
          : botMessages.unavailable;
    return session.send({ type: "text", body });
  }

  const result = await extractExpense(text, context);
  // Toda chamada conta no plano, mesmo a que falhou (tokens, se vieram).
  const usage = recordUsage(admin, project.orgId, today, {
    aiCalls: 1,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
  });

  if (result.kind === "failed") session.noteError?.(`ai_${result.reason}`);
  if (result.kind !== "expense") {
    await Promise.all([
      usage,
      session.send({
        type: "text",
        body:
          result.kind === "not_expense"
            ? botMessages.howTo
            : result.reason === "unavailable"
              ? botMessages.unavailable
              : botMessages.notUnderstood,
      }),
    ]);
    return;
  }

  // Um pendente por vez: o anterior, se havia, é cancelado.
  await Promise.all([usage, discardPending(session)]);

  const { expense } = result;
  if (expense.amountCents === null) {
    await Promise.all([
      saveConversation(admin, userId, {
        state: "awaiting_amount",
        pendingExpenseId: null,
        context: {
          draft: { projectId: project.id, expense, rawInput: text, logId },
        },
      }),
      session.send({
        type: "text",
        body: botMessages.askAmount(expense.description),
      }),
    ]);
    return;
  }

  const pending = await insertPending(
    session,
    project,
    context.stages,
    { ...expense, amountCents: expense.amountCents },
    text,
    logId,
  );
  return presentPending(session, pending, "new");
}

/** Resposta à pergunta do valor: completa o rascunho ou corrige o pendente. */
async function applyAmount(session: BotSession, cents: number): Promise<void> {
  const { admin, userId, conversation } = session;
  const draft = conversation.context.draft;
  if (draft) {
    // A permissão e as etapas ao mesmo tempo; as etapas só valem se a obra
    // continuar entre as que a pessoa pode lançar (e da mesma conta).
    const [projects, stageRows] = await Promise.all([
      listLaunchableProjects(admin, userId),
      stagesOf(admin, draft.projectId),
    ]);
    const project = projects.find((p) => p.id === draft.projectId);
    if (!project) {
      await resetConversation(admin, userId);
      return session.send({ type: "text", body: botMessages.noProjects });
    }
    const stages = stageRows
      .filter((stage) => stage.org_id === project.orgId)
      .map(({ id, name }) => ({ id, name }));
    // A etapa lida pode ter sido apagada enquanto a pessoa respondia.
    const stageId = stages.some((s) => s.id === draft.expense.stageId)
      ? draft.expense.stageId
      : null;
    const pending = await insertPending(
      session,
      project,
      stages,
      { ...draft.expense, stageId, amountCents: cents },
      draft.rawInput,
      draft.logId,
    );
    return presentPending(session, pending, "new");
  }

  const pending = conversation.pending_expense_id
    ? await loadPending(session, conversation.pending_expense_id)
    : null;
  if (!pending) {
    await resetConversation(admin, userId);
    return session.send({ type: "text", body: botMessages.howTo });
  }
  return updateAndPresent(
    session,
    pending,
    { amount_cents: cents },
    { amountCents: cents },
  );
}

// Toques em botões e listas ------------------------------------------------------------

export async function handleAction(
  session: BotSession,
  action: BotAction,
): Promise<void> {
  if (action.type === "project")
    return chooseProject(session, action.projectId);
  if (action.type === "project_page")
    return sendProjectPage(session, action.page);

  const pending = await loadPending(session, action.expenseId);
  if (!pending) {
    if (session.conversation.pending_expense_id === action.expenseId) {
      await resetConversation(session.admin, session.userId);
    }
    return session.send({ type: "text", body: botMessages.alreadyHandled });
  }

  switch (action.type) {
    case "confirm":
      return confirm(session, pending);
    case "cancel": {
      const ok = await updatePending(session, pending, { status: "cancelled" });
      await Promise.all([
        resetConversation(session.admin, session.userId),
        session.send({
          type: "text",
          body: ok ? botMessages.cancelled : botMessages.alreadyHandled,
        }),
      ]);
      return;
    }
    case "edit":
      await Promise.all([
        setState(session, "awaiting_confirmation", pending),
        session.send(editMenuMessage(pending.id)),
      ]);
      return;
    case "edit_field":
      return editField(session, pending, action.field);
    case "stage": {
      if (
        action.stageId &&
        !pending.stages.some((s) => s.id === action.stageId)
      ) {
        return session.send({ type: "text", body: botMessages.alreadyHandled });
      }
      const stageName =
        pending.stages.find((s) => s.id === action.stageId)?.name ?? null;
      if (action.mode === "confirm") {
        // Etapa e confirmação numa gravação só.
        return confirm(
          session,
          { ...pending, stageId: action.stageId, stageName },
          { stage_id: action.stageId },
        );
      }
      return updateAndPresent(
        session,
        pending,
        { stage_id: action.stageId },
        { stageId: action.stageId, stageName },
      );
    }
    case "stage_page":
      return session.send(
        stageListMessage({
          body:
            action.mode === "confirm"
              ? `${summaryOf(pending)}\n\n${botMessages.stageQuestion}`
              : botMessages.stageEditQuestion,
          mode: action.mode,
          stages: pending.stages,
          page: action.page,
          expenseId: pending.id,
        }),
      );
    case "category": {
      if (!Object.hasOwn(CATEGORY_NAMES, action.code)) {
        return session.send({ type: "text", body: botMessages.alreadyHandled });
      }
      const categoryId = await categoryIdOf(session.admin, action.code);
      return updateAndPresent(
        session,
        pending,
        { category_id: categoryId },
        { categoryCode: action.code },
      );
    }
    case "date": {
      if (!isIsoDate(action.date) || action.date > addDays(pending.today, 1)) {
        return session.send({ type: "text", body: botMessages.alreadyHandled });
      }
      return updateAndPresent(
        session,
        pending,
        { spent_on: action.date },
        { spentOn: action.date },
      );
    }
  }
}

async function editField(
  session: BotSession,
  pending: PendingExpense,
  field: "amount" | "stage" | "category" | "date",
): Promise<void> {
  await Promise.all([
    setState(
      session,
      field === "amount" ? "awaiting_amount" : "awaiting_confirmation",
      pending,
    ),
    session.send(editFieldMessage(pending, field)),
  ]);
}

function editFieldMessage(
  pending: PendingExpense,
  field: "amount" | "stage" | "category" | "date",
): OutgoingMessage {
  switch (field) {
    case "amount":
      return { type: "text", body: botMessages.askAmount(pending.description) };
    case "stage":
      return stageListMessage({
        body: botMessages.stageEditQuestion,
        mode: "edit",
        stages: pending.stages,
        page: 0,
        expenseId: pending.id,
      });
    case "category":
      return categoryListMessage(pending.id);
    case "date":
      return dateListMessage(pending.today, pending.id);
  }
}

async function confirm(
  session: BotSession,
  pending: PendingExpense,
  extra: ExpenseUpdate = {},
): Promise<void> {
  // O fornecedor só é cadastrado agora, na confirmação.
  const supplierId = await resolveSupplier(
    session.admin,
    pending.orgId,
    pending.supplierName,
  );
  const ok = await updatePending(session, pending, {
    ...extra,
    supplier_id: supplierId,
    status: "confirmed",
  });
  if (!ok) {
    return session.send({ type: "text", body: botMessages.alreadyHandled });
  }
  // A resposta sai junto com a contagem do plano e a limpeza da conversa.
  await Promise.all([
    session.send({
      type: "text",
      body: botMessages.confirmed(summaryOf(pending)),
    }),
    recordUsage(session.admin, pending.orgId, pending.today, {
      whatsappEntries: 1,
    }),
    resetConversation(session.admin, session.userId),
  ]);
}

async function chooseProject(
  session: BotSession,
  projectId: string,
): Promise<void> {
  const { admin, userId, conversation } = session;
  const projects = await listLaunchableProjects(admin, userId);
  const project = projects.find((p) => p.id === projectId);
  if (!project) {
    return session.send({ type: "text", body: botMessages.noProjects });
  }
  const { pendingText, pendingLogId, pendingCommand } = conversation.context;
  const select = saveConversation(admin, userId, {
    state: "idle",
    activeOrgId: project.orgId,
    activeProjectId: project.id,
    context: keepPendingSupplier(conversation.context),
  });
  if (pendingText && pendingCommand !== "summary") {
    // A leitura grava o estado da conversa depois: espera a troca da obra.
    await select;
    return readExpense(session, project, pendingText, pendingLogId ?? null);
  }
  await Promise.all([
    select,
    pendingCommand === "summary"
      ? sendProjectSummary(session, project)
      : session.send({
          type: "text",
          body: botMessages.projectSelected(project.name),
        }),
  ]);
}

// Gasto pendente --------------------------------------------------------------------

type PendingExpense = {
  id: string;
  orgId: string;
  projectId: string;
  projectName: string;
  today: string;
  amountCents: number;
  description: string;
  categoryCode: string;
  stageId: string | null;
  stageName: string | null;
  supplierName: string | null;
  spentOn: string;
  paymentMethod: string | null;
  hasInvoice: boolean;
  stages: { id: string; name: string }[];
};

function summaryOf(pending: PendingExpense): string {
  return formatSummary(pending, pending.today);
}

/**
 * Gasto pendente desta pessoa (ou null se já confirmado, cancelado ou de
 * outro). Confere também se ela ainda pode lançar naquela obra: quem perdeu o
 * acesso depois de mandar a mensagem não confirma nem edita (o pendente é
 * cancelado).
 */
async function loadPending(
  session: BotSession,
  expenseId: string,
): Promise<PendingExpense | null> {
  const { admin, userId } = session;
  const [{ data, error }, projects] = await Promise.all([
    admin
      .from("expenses")
      .select(
        "id, org_id, project_id, stage_id, amount_cents, description, spent_on, payment_method, has_invoice, categories(code), projects(name, organizations(timezone), stages(id, name, sort_order))",
      )
      .eq("id", expenseId)
      .eq("created_by", userId)
      .eq("status", "pending")
      .is("deleted_at", null)
      .maybeSingle(),
    listLaunchableProjects(admin, userId),
  ]);
  if (error) throw error;
  if (!data) return null;
  if (
    !projects.some((p) => p.id === data.project_id && p.orgId === data.org_id)
  ) {
    const { error: cancelError } = await admin
      .from("expenses")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("org_id", data.org_id)
      .eq("created_by", userId)
      .eq("status", "pending");
    if (cancelError) throw cancelError;
    return null;
  }

  // O nome lido fica na conversa até a confirmação (o pendente não tem
  // fornecedor gravado).
  const { pendingSupplier } = session.conversation.context;
  const supplierName =
    pendingSupplier?.expenseId === data.id ? pendingSupplier.name : null;

  const stages = [...(data.projects?.stages ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ id, name }) => ({ id, name }));

  return {
    id: data.id,
    orgId: data.org_id,
    projectId: data.project_id,
    projectName: data.projects?.name ?? "",
    today: todayIn(data.projects?.organizations?.timezone ?? undefined),
    amountCents: data.amount_cents,
    description: data.description,
    categoryCode: data.categories?.code ?? "outros",
    stageId: data.stage_id,
    stageName: stages.find((s) => s.id === data.stage_id)?.name ?? null,
    supplierName,
    spentOn: data.spent_on,
    paymentMethod: data.payment_method,
    hasInvoice: data.has_invoice,
    stages,
  };
}

/** Etapas da obra, com a conta (quem chama confere o org_id). */
async function stagesOf(admin: Admin, projectId: string) {
  const { data, error } = await admin
    .from("stages")
    .select("id, name, org_id")
    .eq("project_id", projectId)
    .order("sort_order");
  if (error) throw error;
  return data;
}

type ExpenseUpdate = Database["public"]["Tables"]["expenses"]["Update"];

/** Altera o pendente; devolve false se ele já não estava pendente. */
async function updatePending(
  session: BotSession,
  pending: PendingExpense,
  fields: ExpenseUpdate,
): Promise<boolean> {
  const { data, error } = await session.admin
    .from("expenses")
    .update(fields)
    .eq("id", pending.id)
    .eq("org_id", pending.orgId)
    .eq("created_by", session.userId)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  return data.length > 0;
}

/** Grava a mudança e mostra o resumo de novo, sem reler o gasto. */
async function updateAndPresent(
  session: BotSession,
  pending: PendingExpense,
  fields: ExpenseUpdate,
  changes: Partial<PendingExpense>,
): Promise<void> {
  const ok = await updatePending(session, pending, fields);
  if (!ok) {
    await resetConversation(session.admin, session.userId);
    return session.send({ type: "text", body: botMessages.alreadyHandled });
  }
  return presentPending(session, { ...pending, ...changes }, "updated");
}

/** Mostra o pendente: lista de etapas (se faltou) ou o resumo com botões. */
async function presentPending(
  session: BotSession,
  pending: PendingExpense,
  mode: "new" | "updated",
): Promise<void> {
  const summary = summaryOf(pending);
  const askStage =
    mode === "new" && !pending.stageId && pending.stages.length > 0;
  await Promise.all([
    setState(
      session,
      askStage ? "awaiting_stage" : "awaiting_confirmation",
      pending,
    ),
    session.send(
      askStage
        ? stageListMessage({
            body: `${summary}\n\n${botMessages.stageQuestion}`,
            mode: "confirm",
            stages: pending.stages,
            page: 0,
            expenseId: pending.id,
          })
        : summaryMessage(summary, pending.id),
    ),
  ]);
}

/** Estado da conversa com o pendente; o fornecedor lido vai junto. */
function setState(
  session: BotSession,
  state: ConversationState,
  pending: PendingExpense,
) {
  return saveConversation(session.admin, session.userId, {
    state,
    pendingExpenseId: pending.id,
    context: pending.supplierName
      ? {
          pendingSupplier: {
            expenseId: pending.id,
            name: pending.supplierName,
          },
        }
      : {},
  });
}

/** Cancela o pendente anterior da conversa, se houver. */
async function discardPending(session: BotSession): Promise<void> {
  const id = session.conversation.pending_expense_id;
  if (!id) return;
  await session.admin
    .from("expenses")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("created_by", session.userId)
    .eq("status", "pending");
}

/** Categorias padrão do sistema não mudam: guarda os ids depois da 1ª leitura. */
const categoryIds = new Map<string, string>();

async function categoryIdOf(admin: Admin, code: string): Promise<string> {
  const cached = categoryIds.get(code);
  if (cached) return cached;
  const { data, error } = await admin
    .from("categories")
    .select("id")
    .is("org_id", null)
    .eq("code", code)
    .single();
  if (error) throw error;
  categoryIds.set(code, data.id);
  return data.id;
}

/** Cria o gasto pendente e devolve os dados para o resumo. */
async function insertPending(
  session: BotSession,
  project: LaunchableProject,
  stages: { id: string; name: string }[],
  expense: ExtractedExpense & { amountCents: number },
  rawInput: string,
  logId: string | null,
): Promise<PendingExpense> {
  const { admin, userId } = session;

  // Sem fornecedor no pendente: o nome lido fica na conversa (setState) e o
  // cadastro só nasce se a pessoa confirmar.
  const categoryId = await categoryIdOf(admin, expense.categoryCode);

  const { data, error } = await admin
    .from("expenses")
    .insert({
      org_id: project.orgId,
      project_id: project.id,
      stage_id: expense.stageId,
      category_id: categoryId,
      supplier_id: null,
      description: expense.description,
      amount_cents: expense.amountCents,
      quantity: expense.quantity,
      unit: expense.unit,
      spent_on: expense.spentOn,
      payment_method: expense.paymentMethod,
      has_invoice: expense.hasInvoice,
      status: "pending",
      source: "whatsapp_text",
      raw_input: rawInput.slice(0, 2000),
      ai_confidence: Math.round(expense.confidence * 100) / 100,
      created_by: userId,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;

  await Promise.all([
    // Um pendente por vez, mesmo com mensagens chegando juntas: os pendentes
    // mais antigos desta pessoa nesta conta são cancelados (o mais novo fica).
    admin
      .from("expenses")
      .update({ status: "cancelled" })
      .eq("org_id", project.orgId)
      .eq("created_by", userId)
      .eq("status", "pending")
      .in("source", WHATSAPP_SOURCES)
      .lt("created_at", data.created_at)
      .then(({ error: cancelError }) => {
        if (cancelError) {
          console.error("[whatsapp] pendente antigo ficou", cancelError);
        }
      }),
    logId
      ? admin
          .from("whatsapp_messages")
          .update({ expense_id: data.id, org_id: project.orgId })
          .eq("id", logId)
          .then(({ error: logError }) => {
            if (logError) console.error("[whatsapp] log sem o gasto", logError);
          })
      : Promise.resolve(),
  ]);

  return {
    id: data.id,
    orgId: project.orgId,
    projectId: project.id,
    projectName: project.name,
    today: todayIn(project.timezone),
    amountCents: expense.amountCents,
    description: expense.description,
    categoryCode: expense.categoryCode,
    stageId: expense.stageId,
    stageName: stages.find((s) => s.id === expense.stageId)?.name ?? null,
    supplierName: expense.supplierName,
    spentOn: expense.spentOn,
    paymentMethod: expense.paymentMethod,
    hasInvoice: expense.hasInvoice,
    stages,
  };
}
