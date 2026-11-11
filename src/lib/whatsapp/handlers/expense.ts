import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveSupplier } from "@/features/suppliers/resolve";
import { loadExtractionContext } from "@/lib/ai/context";
import {
  type ExtractedExpense,
  type ExtractionContext,
  extractExpense,
} from "@/lib/ai/extract-expense";
import {
  maxReceiptBytes,
  type ReceiptDetails,
  type ReceiptMimeType,
  readReceipt,
  receiptMimeType,
} from "@/lib/ai/read-receipt";
import { canUseWhatsappAi } from "@/lib/billing/limits";
import { recordUsage } from "@/lib/billing/usage";
import { addDays, isIsoDate, todayIn } from "@/lib/dates";
import { isValidAmountCents, parseMoneyToCents } from "@/lib/money";
import type { Database } from "@/types/database";

import type { BotAction } from "../actions";
import {
  downloadMedia,
  MediaTooLargeError,
  type OutgoingMessage,
} from "../client";
import {
  type Conversation,
  type ConversationContext,
  type ConversationState,
  keepPendingSupplier,
  type ReceiptMedia,
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
  heardPrefix,
  parseAmountReply,
  projectListMessage,
  stageListMessage,
  summaryMessage,
} from "../messages";
import { type LaunchableProject, listLaunchableProjects } from "../projects";
import { saveReceipt } from "../receipts";
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

/** Origem de um gasto lido de texto: escrito ou transcrito de um áudio. */
export type TextSource = "whatsapp_text" | "whatsapp_audio";

export async function handleText(
  session: BotSession,
  text: string,
  logId: string | null,
  source: TextSource = "whatsapp_text",
): Promise<void> {
  const { conversation } = session;
  if (conversation.state === "awaiting_amount") {
    // A transcrição termina com ponto ("300.").
    const amount = parseAmountReply(
      source === "whatsapp_audio" ? text.replace(/[.!?…]+$/u, "") : text,
    );
    if (amount !== null) {
      const cents = parseMoneyToCents(amount);
      if (cents === null || !isValidAmountCents(cents)) {
        return session.send({ type: "text", body: botMessages.askAmountAgain });
      }
      return applyAmount(session, cents);
    }
    // Não é só um número: é um gasto novo.
  }
  const project = await projectForNewExpense(session, {
    pendingText: text,
    pendingLogId: logId,
    ...(source === "whatsapp_audio" ? { pendingAudio: true } : {}),
  });
  if (!project) return;
  await Promise.all([
    rememberActiveProject(session, project),
    readExpense(session, project, text, logId, source),
  ]);
}

// Foto ou PDF de comprovante --------------------------------------------------------

export async function handleReceipt(
  session: BotSession,
  media: ReceiptMedia,
  logId: string | null,
): Promise<void> {
  if (!receiptMimeType(media.mimeType)) {
    session.noteError?.("media_unsupported");
    return session.send({ type: "text", body: botMessages.receiptUnsupported });
  }
  const project = await projectForNewExpense(session, {
    pendingMedia: media,
    pendingLogId: logId,
  });
  if (!project) return;
  await Promise.all([
    rememberActiveProject(session, project),
    readReceiptMessage(session, project, media, logId),
  ]);
}

/**
 * Obra do gasto novo: a ativa, ou a única. Com várias e nenhuma ativa,
 * pergunta qual (a mensagem fica guardada em `pending`) e devolve null.
 */
async function projectForNewExpense(
  session: BotSession,
  pending: ConversationContext,
): Promise<LaunchableProject | null> {
  const { admin, userId, conversation } = session;
  const projects = await listLaunchableProjects(admin, userId);
  if (!projects.length) {
    await resetConversation(admin, userId);
    await session.send({ type: "text", body: botMessages.noProjects });
    return null;
  }

  const project =
    projects.find((p) => p.id === conversation.active_project_id) ??
    (projects.length === 1 ? projects[0] : undefined);
  if (project) return project;

  const orgCount = new Set(projects.map((p) => p.orgId)).size;
  await Promise.all([
    discardPending(session),
    saveConversation(admin, userId, {
      state: "awaiting_project",
      pendingExpenseId: null,
      context: pending,
    }),
    session.send(projectListMessage(projects, orgCount > 1)),
  ]);
  return null;
}

/**
 * Guarda a obra ativa. Não muda o que a leitura faz: vai em paralelo (só
 * mexe nas colunas da obra; o estado da conversa é gravado depois da IA).
 */
function rememberActiveProject(
  session: BotSession,
  project: LaunchableProject,
): Promise<void> {
  if (project.id === session.conversation.active_project_id) {
    return Promise.resolve();
  }
  return saveConversation(session.admin, session.userId, {
    activeOrgId: project.orgId,
    activeProjectId: project.id,
  }).catch((error: unknown) =>
    // Sem a obra ativa gravada, a próxima mensagem só pergunta de novo.
    console.error("[whatsapp] falha ao guardar a obra ativa", error),
  );
}

/**
 * Limite do plano e contexto da obra ao mesmo tempo. Fora do limite, avisa a
 * pessoa e devolve null.
 */
async function aiContextOrRefuse(
  session: BotSession,
  project: LaunchableProject,
  today: string,
): Promise<ExtractionContext | null> {
  const [allowed, context] = await Promise.all([
    canUseWhatsappAi(session.admin, project.orgId, today),
    loadExtractionContext(
      session.admin,
      project.orgId,
      project.id,
      project.timezone,
    ),
  ]);
  if (allowed.ok) return context;
  await refuseAi(session, allowed.reason);
  return null;
}

/**
 * Limite do plano antes de usar IA fora da leitura do gasto (ex.: ouvir um
 * áudio). Fora do limite, avisa a pessoa e devolve false.
 */
export async function checkAiAllowed(
  session: BotSession,
  orgId: string,
  today: string,
): Promise<boolean> {
  const allowed = await canUseWhatsappAi(session.admin, orgId, today);
  if (allowed.ok) return true;
  await refuseAi(session, allowed.reason);
  return false;
}

async function refuseAi(session: BotSession, reason: string): Promise<void> {
  session.noteError?.(`limit_${reason}`);
  const body =
    reason === "whatsapp_disabled"
      ? botMessages.whatsappDisabled
      : reason === "max_whatsapp_entries" || reason === "max_ai_calls"
        ? botMessages.limitReached
        : botMessages.unavailable;
  await session.send({ type: "text", body });
}

/**
 * IA lê a mensagem; o gasto nasce pendente (ou vira rascunho sem valor).
 * Veio de um áudio: a resposta começa com o que o bot ouviu.
 */
async function readExpense(
  session: BotSession,
  project: LaunchableProject,
  text: string,
  logId: string | null,
  source: TextSource = "whatsapp_text",
): Promise<void> {
  const { admin, userId } = session;
  const heard = source === "whatsapp_audio" ? heardPrefix(text) : "";
  const today = todayIn(project.timezone);
  const context = await aiContextOrRefuse(session, project, today);
  if (!context) return;

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
          heard +
          (result.kind === "not_expense"
            ? botMessages.howTo
            : result.reason === "unavailable"
              ? botMessages.unavailable
              : botMessages.notUnderstood),
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
          draft: {
            projectId: project.id,
            expense,
            rawInput: text,
            logId,
            ...(source === "whatsapp_audio" ? { audio: true } : {}),
          },
        },
      }),
      session.send({
        type: "text",
        body: heard + botMessages.askAmount(expense.description),
      }),
    ]);
    return;
  }

  const pending = await insertPending(
    session,
    project,
    context.stages,
    { ...expense, amountCents: expense.amountCents },
    { rawInput: text, logId, source },
  );
  return presentPending(session, pending, "new", heard);
}

/** Arquivo baixado da Meta, já com o tipo conferido. */
type ReceiptFile = { data: ArrayBuffer; mimeType: ReceiptMimeType };

/**
 * Baixa o comprovante. Falhou ou é grande demais: avisa a pessoa e devolve
 * null.
 */
async function fetchReceipt(
  session: BotSession,
  media: ReceiptMedia,
): Promise<ReceiptFile | null> {
  const declared = receiptMimeType(media.mimeType);
  if (!declared) {
    session.noteError?.("media_unsupported");
    await session.send({ type: "text", body: botMessages.receiptUnsupported });
    return null;
  }
  try {
    const file = await downloadMedia(media.id, maxReceiptBytes(declared));
    const mimeType = receiptMimeType(file.mimeType) ?? declared;
    if (file.data.byteLength > maxReceiptBytes(mimeType)) {
      throw new MediaTooLargeError(file.data.byteLength);
    }
    return { data: file.data, mimeType };
  } catch (error) {
    const tooLarge = error instanceof MediaTooLargeError;
    if (!tooLarge) console.error("[whatsapp] falha ao baixar a mídia", error);
    session.noteError?.(tooLarge ? "media_too_large" : "media_download_failed");
    await session.send({
      type: "text",
      body: tooLarge
        ? botMessages.receiptTooLarge
        : botMessages.receiptDownloadFailed,
    });
    return null;
  }
}

/** IA lê o comprovante; o gasto nasce pendente com a foto e os itens. */
async function readReceiptMessage(
  session: BotSession,
  project: LaunchableProject,
  media: ReceiptMedia,
  logId: string | null,
): Promise<void> {
  const { admin, userId } = session;
  const today = todayIn(project.timezone);
  // Limite e contexto junto com o download: são independentes.
  const [context, file] = await Promise.all([
    aiContextOrRefuse(session, project, today),
    fetchReceipt(session, media),
  ]);
  if (!context || !file) return;

  const result = await readReceipt(file, media.caption, context);
  const usage = recordUsage(admin, project.orgId, today, {
    aiCalls: 1,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
  });

  if (result.kind === "failed") session.noteError?.(`ai_${result.reason}`);
  if (result.kind !== "receipt") {
    await Promise.all([
      usage,
      session.send({
        type: "text",
        body:
          result.kind === "not_receipt"
            ? botMessages.notAReceipt
            : result.reason === "unavailable"
              ? botMessages.unavailable
              : botMessages.receiptNotUnderstood,
      }),
    ]);
    return;
  }

  await Promise.all([usage, discardPending(session)]);

  const { expense, details } = result;
  if (expense.amountCents === null) {
    // A foto fica na Meta: é baixada de novo quando o valor chegar.
    await Promise.all([
      saveConversation(admin, userId, {
        state: "awaiting_amount",
        pendingExpenseId: null,
        context: {
          draft: {
            projectId: project.id,
            expense,
            rawInput: media.caption,
            logId,
            receipt: {
              media: { ...media, mimeType: file.mimeType },
              details,
            },
          },
        },
      }),
      session.send({
        type: "text",
        body: botMessages.askReceiptAmount(expense.description),
      }),
    ]);
    return;
  }

  const pending = await insertPending(
    session,
    project,
    context.stages,
    { ...expense, amountCents: expense.amountCents },
    {
      rawInput: media.caption,
      logId,
      source: "whatsapp_image",
      receipt: { file, details },
    },
  );
  return presentPending(session, pending, "new");
}

/** Baixa de novo a foto de um rascunho (sem avisar a pessoa se falhar). */
async function refetchReceipt(
  media: ReceiptMedia,
): Promise<ReceiptFile | null> {
  const mimeType = receiptMimeType(media.mimeType);
  if (!mimeType) return null;
  try {
    const file = await downloadMedia(media.id, maxReceiptBytes(mimeType));
    return { data: file.data, mimeType };
  } catch (error) {
    console.error("[whatsapp] falha ao baixar a mídia de novo", error);
    return null;
  }
}

/** Resposta à pergunta do valor: completa o rascunho ou corrige o pendente. */
async function applyAmount(session: BotSession, cents: number): Promise<void> {
  const { admin, userId, conversation } = session;
  const draft = conversation.context.draft;
  if (draft) {
    // A permissão, as etapas e a foto (se veio de comprovante) ao mesmo
    // tempo; as etapas só valem se a obra continuar entre as que a pessoa
    // pode lançar (e da mesma conta).
    const [projects, stageRows, file] = await Promise.all([
      listLaunchableProjects(admin, userId),
      stagesOf(admin, draft.projectId),
      draft.receipt ? refetchReceipt(draft.receipt.media) : null,
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
    if (draft.receipt && !file) session.noteError?.("receipt_refetch_failed");
    const pending = await insertPending(
      session,
      project,
      stages,
      { ...draft.expense, stageId, amountCents: cents },
      {
        rawInput: draft.rawInput,
        logId: draft.logId,
        source: draft.receipt
          ? "whatsapp_image"
          : draft.audio
            ? "whatsapp_audio"
            : "whatsapp_text",
        receipt: draft.receipt
          ? { file, details: draft.receipt.details }
          : undefined,
      },
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
    pending.supplierDocument,
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
  const {
    pendingText,
    pendingAudio,
    pendingMedia,
    pendingLogId,
    pendingCommand,
  } = conversation.context;
  const select = saveConversation(admin, userId, {
    state: "idle",
    activeOrgId: project.orgId,
    activeProjectId: project.id,
    context: keepPendingSupplier(conversation.context),
  });
  if (pendingCommand !== "summary" && (pendingText || pendingMedia)) {
    // A leitura grava o estado da conversa depois: espera a troca da obra.
    await select;
    return pendingMedia
      ? readReceiptMessage(session, project, pendingMedia, pendingLogId ?? null)
      : readExpense(
          session,
          project,
          pendingText ?? "",
          pendingLogId ?? null,
          pendingAudio ? "whatsapp_audio" : "whatsapp_text",
        );
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
  /** CNPJ/CPF do fornecedor lido do comprovante (gravado ao confirmar). */
  supplierDocument: string | null;
  spentOn: string;
  paymentMethod: string | null;
  hasInvoice: boolean;
  itemCount: number;
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
        "id, org_id, project_id, stage_id, amount_cents, description, spent_on, payment_method, has_invoice, categories(code), expense_items(count), projects(name, organizations(timezone), stages(id, name, sort_order))",
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
  const supplier =
    pendingSupplier?.expenseId === data.id ? pendingSupplier : null;

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
    supplierName: supplier?.name ?? null,
    supplierDocument: supplier?.document ?? null,
    spentOn: data.spent_on,
    paymentMethod: data.payment_method,
    hasInvoice: data.has_invoice,
    itemCount: data.expense_items[0]?.count ?? 0,
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
  /** Texto antes do resumo (o que o bot ouviu de um áudio). */
  prefix = "",
): Promise<void> {
  const summary = prefix + summaryOf(pending);
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
            document: pending.supplierDocument,
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

/** De onde veio o pendente. */
type PendingInput = {
  rawInput: string | null;
  logId: string | null;
  source: TextSource | "whatsapp_image";
  /** Comprovante: a foto (se baixou) e o que foi lido dela. */
  receipt?: { file: ReceiptFile | null; details: ReceiptDetails };
};

/** Cria o gasto pendente e devolve os dados para o resumo. */
async function insertPending(
  session: BotSession,
  project: LaunchableProject,
  stages: { id: string; name: string }[],
  expense: ExtractedExpense & { amountCents: number },
  input: PendingInput,
): Promise<PendingExpense> {
  const { admin, userId } = session;
  const { rawInput, logId, source, receipt } = input;

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
      invoice_number: receipt?.details.invoiceNumber ?? null,
      nfe_access_key: receipt?.details.accessKey ?? null,
      status: "pending",
      source,
      raw_input: rawInput?.slice(0, 2000) || null,
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
    // A foto e os itens não impedem o lançamento: se falharem, ficam no log.
    receipt
      ? saveReceipt(admin, {
          orgId: project.orgId,
          expenseId: data.id,
          userId,
          file: receipt.file,
          items: receipt.details.items,
        }).then((ok) => {
          if (!ok) session.noteError?.("receipt_save_failed");
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
    supplierDocument: receipt?.details.supplierDocument ?? null,
    spentOn: expense.spentOn,
    paymentMethod: expense.paymentMethod,
    hasInvoice: expense.hasInvoice,
    itemCount: receipt?.details.items.length ?? 0,
    stages,
  };
}
