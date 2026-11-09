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
  resetConversation,
  saveConversation,
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
    await discardPending(session);
    await saveConversation(admin, userId, {
      state: "awaiting_project",
      pendingExpenseId: null,
      context: { pendingText: text, pendingLogId: logId },
    });
    const orgCount = new Set(projects.map((p) => p.orgId)).size;
    return session.send(projectListMessage(projects, orgCount > 1));
  }

  if (project.id !== conversation.active_project_id) {
    await saveConversation(admin, userId, {
      activeOrgId: project.orgId,
      activeProjectId: project.id,
    });
  }
  return readExpense(session, project, text, logId);
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

  const allowed = await canUseWhatsappAi(admin, project.orgId, today);
  if (!allowed.ok) {
    const body =
      allowed.reason === "whatsapp_disabled"
        ? botMessages.whatsappDisabled
        : allowed.reason === "max_whatsapp_entries" ||
            allowed.reason === "max_ai_calls"
          ? botMessages.limitReached
          : botMessages.unavailable;
    return session.send({ type: "text", body });
  }

  const context = await loadExtractionContext(
    admin,
    project.orgId,
    project.id,
    project.timezone,
  );
  const result = await extractExpense(text, context);
  if (result.usage) {
    await recordUsage(admin, project.orgId, today, {
      aiCalls: 1,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    });
  }

  if (result.kind === "failed") {
    return session.send({
      type: "text",
      body:
        result.reason === "unavailable"
          ? botMessages.unavailable
          : botMessages.notUnderstood,
    });
  }
  if (result.kind === "not_expense") {
    return session.send({ type: "text", body: botMessages.howTo });
  }

  // Um pendente por vez: o anterior, se havia, é cancelado.
  await discardPending(session);

  const { expense } = result;
  if (expense.amountCents === null) {
    await saveConversation(admin, userId, {
      state: "awaiting_amount",
      pendingExpenseId: null,
      context: {
        draft: { projectId: project.id, expense, rawInput: text, logId },
      },
    });
    return session.send({
      type: "text",
      body: botMessages.askAmount(expense.description),
    });
  }

  const expenseId = await insertPending(session, project, expense, text, logId);
  return presentExpense(session, expenseId, "new");
}

/** Resposta à pergunta do valor: completa o rascunho ou corrige o pendente. */
async function applyAmount(session: BotSession, cents: number): Promise<void> {
  const { admin, userId, conversation } = session;
  const draft = conversation.context.draft;
  if (draft) {
    const projects = await listLaunchableProjects(admin, userId);
    const project = projects.find((p) => p.id === draft.projectId);
    if (!project) {
      await resetConversation(admin, userId);
      return session.send({ type: "text", body: botMessages.noProjects });
    }
    const expenseId = await insertPending(
      session,
      project,
      { ...draft.expense, amountCents: cents },
      draft.rawInput,
      draft.logId,
    );
    return presentExpense(session, expenseId, "new");
  }

  const pending = conversation.pending_expense_id
    ? await loadPending(session, conversation.pending_expense_id)
    : null;
  if (!pending) {
    await resetConversation(admin, userId);
    return session.send({ type: "text", body: botMessages.howTo });
  }
  await updatePending(session, pending, { amount_cents: cents });
  return presentExpense(session, pending.id, "updated");
}

// Toques em botões e listas ------------------------------------------------------------

export async function handleAction(
  session: BotSession,
  action: BotAction,
): Promise<void> {
  if (action.type === "project")
    return chooseProject(session, action.projectId);

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
    case "cancel":
      await updatePending(session, pending, { status: "cancelled" });
      await resetConversation(session.admin, session.userId);
      return session.send({ type: "text", body: botMessages.cancelled });
    case "edit":
      await setState(session, "awaiting_confirmation", pending.id);
      return session.send(editMenuMessage(pending.id));
    case "edit_field":
      return editField(session, pending, action.field);
    case "stage": {
      if (
        action.stageId &&
        !pending.stages.some((s) => s.id === action.stageId)
      ) {
        return session.send({ type: "text", body: botMessages.alreadyHandled });
      }
      await updatePending(session, pending, { stage_id: action.stageId });
      if (action.mode === "confirm") {
        const stageName =
          pending.stages.find((s) => s.id === action.stageId)?.name ?? null;
        return confirm(session, {
          ...pending,
          stageId: action.stageId,
          stageName,
        });
      }
      return presentExpense(session, pending.id, "updated");
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
      if (!(action.code in CATEGORY_NAMES)) {
        return session.send({ type: "text", body: botMessages.alreadyHandled });
      }
      const categoryId = await categoryIdOf(session.admin, action.code);
      await updatePending(session, pending, { category_id: categoryId });
      return presentExpense(session, pending.id, "updated");
    }
    case "date": {
      if (!isIsoDate(action.date) || action.date > addDays(pending.today, 1)) {
        return session.send({ type: "text", body: botMessages.alreadyHandled });
      }
      await updatePending(session, pending, { spent_on: action.date });
      return presentExpense(session, pending.id, "updated");
    }
  }
}

async function editField(
  session: BotSession,
  pending: PendingExpense,
  field: "amount" | "stage" | "category" | "date",
): Promise<void> {
  await setState(
    session,
    field === "amount" ? "awaiting_amount" : "awaiting_confirmation",
    pending.id,
  );
  switch (field) {
    case "amount":
      return session.send({
        type: "text",
        body: botMessages.askAmount(pending.description),
      });
    case "stage":
      return session.send(
        stageListMessage({
          body: botMessages.stageEditQuestion,
          mode: "edit",
          stages: pending.stages,
          page: 0,
          expenseId: pending.id,
        }),
      );
    case "category":
      return session.send(categoryListMessage(pending.id));
    case "date":
      return session.send(dateListMessage(pending.today, pending.id));
  }
}

async function confirm(
  session: BotSession,
  pending: PendingExpense,
): Promise<void> {
  const ok = await updatePending(session, pending, { status: "confirmed" });
  if (!ok)
    return session.send({ type: "text", body: botMessages.alreadyHandled });
  await recordUsage(session.admin, pending.orgId, pending.today, {
    whatsappEntries: 1,
  });
  await resetConversation(session.admin, session.userId);
  return session.send({
    type: "text",
    body: botMessages.confirmed(summaryOf(pending)),
  });
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
  const { pendingText, pendingLogId } = conversation.context;
  await saveConversation(admin, userId, {
    state: "idle",
    activeOrgId: project.orgId,
    activeProjectId: project.id,
    context: {},
  });
  if (pendingText) {
    return readExpense(session, project, pendingText, pendingLogId ?? null);
  }
  return session.send({
    type: "text",
    body: botMessages.projectSelected(project.name),
  });
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

/** Gasto pendente desta pessoa (ou null se já confirmado, cancelado ou de outro). */
async function loadPending(
  session: BotSession,
  expenseId: string,
): Promise<PendingExpense | null> {
  const { admin, userId } = session;
  const { data, error } = await admin
    .from("expenses")
    .select(
      "id, org_id, project_id, stage_id, amount_cents, description, spent_on, payment_method, has_invoice, categories(code), suppliers(name), projects(name, organizations(timezone))",
    )
    .eq("id", expenseId)
    .eq("created_by", userId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: stages, error: stagesError } = await admin
    .from("stages")
    .select("id, name")
    .eq("org_id", data.org_id)
    .eq("project_id", data.project_id)
    .order("sort_order");
  if (stagesError) throw stagesError;

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
    supplierName: data.suppliers?.name ?? null,
    spentOn: data.spent_on,
    paymentMethod: data.payment_method,
    hasInvoice: data.has_invoice,
    stages,
  };
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

/** Mostra o pendente: lista de etapas (se faltou) ou o resumo com botões. */
async function presentExpense(
  session: BotSession,
  expenseId: string,
  mode: "new" | "updated",
): Promise<void> {
  const pending = await loadPending(session, expenseId);
  if (!pending) {
    await resetConversation(session.admin, session.userId);
    return session.send({ type: "text", body: botMessages.alreadyHandled });
  }
  const summary = summaryOf(pending);

  if (mode === "new" && !pending.stageId && pending.stages.length) {
    await setState(session, "awaiting_stage", pending.id);
    return session.send(
      stageListMessage({
        body: `${summary}\n\n${botMessages.stageQuestion}`,
        mode: "confirm",
        stages: pending.stages,
        page: 0,
        expenseId: pending.id,
      }),
    );
  }
  await setState(session, "awaiting_confirmation", pending.id);
  return session.send(summaryMessage(summary, pending.id));
}

function setState(
  session: BotSession,
  state: ConversationState,
  pendingExpenseId: string,
) {
  return saveConversation(session.admin, session.userId, {
    state,
    pendingExpenseId,
    context: {},
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

async function categoryIdOf(admin: Admin, code: string): Promise<string> {
  const { data, error } = await admin
    .from("categories")
    .select("id")
    .is("org_id", null)
    .eq("code", code)
    .single();
  if (error) throw error;
  return data.id;
}

async function insertPending(
  session: BotSession,
  project: LaunchableProject,
  expense: ExtractedExpense & { amountCents: number | null },
  rawInput: string,
  logId: string | null,
): Promise<string> {
  const { admin, userId } = session;
  if (expense.amountCents === null) throw new Error("Gasto sem valor.");

  const [categoryId, supplierId] = await Promise.all([
    categoryIdOf(admin, expense.categoryCode),
    resolveSupplier(admin, project.orgId, expense.supplierName),
  ]);

  const { data, error } = await admin
    .from("expenses")
    .insert({
      org_id: project.orgId,
      project_id: project.id,
      stage_id: expense.stageId,
      category_id: categoryId,
      supplier_id: supplierId,
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
    .select("id")
    .single();
  if (error) throw error;

  if (logId) {
    await admin
      .from("whatsapp_messages")
      .update({ expense_id: data.id, org_id: project.orgId })
      .eq("id", logId);
  }
  return data.id;
}
