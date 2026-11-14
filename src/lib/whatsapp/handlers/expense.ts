import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { cleanStageName, findOrCreateStage } from "@/features/stages/create";
import { resolveSupplier } from "@/features/suppliers/resolve";
import { loadExtractionContext } from "@/lib/ai/context";
import {
  type ExtractedExpense,
  type ExtractionContext,
  extractExpense,
} from "@/lib/ai/extract-expense";
import {
  itemsMatchingTotal,
  maxReceiptBytes,
  type ReceiptDetails,
  type ReceiptMimeType,
  readReceipt,
  receiptMimeType,
} from "@/lib/ai/read-receipt";
import {
  canAskWhatsappQuestion,
  type LimitResult,
  whatsappAllowance,
} from "@/lib/billing/limits";
import { recordUsage } from "@/lib/billing/usage";
import { addDays, isIsoDate, todayIn } from "@/lib/dates";
import { isValidAmountCents, parseMoneyToCents } from "@/lib/money";
import type { Database } from "@/types/database";

import type { BotAction, EditField } from "../actions";
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
  type TextEditField,
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
  formatSummaryLine,
  heardPrefix,
  invoiceButtonsMessage,
  moveListMessage,
  parseAmountReply,
  PAYMENT_NAMES,
  paymentListMessage,
  projectListMessage,
  splitItemsListMessage,
  splitProposalMessage,
  splitStageListMessage,
  stageListMessage,
  summaryMessage,
} from "../messages";
import {
  type BotProject,
  type LaunchableProject,
  listBotProjects,
  listLaunchableProjects,
} from "../projects";
import { copyReceipts, saveReceipt } from "../receipts";
import {
  distinctStages,
  groupDescription,
  type SplitItem,
  splitGroups,
  splitProposalLines,
} from "../split";
import { sendProjectPage, sendProjectSummary } from "./commands";
import { answerQuestion } from "./question";

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
  const { editing } = conversation.context;
  if (editing && editing.expenseId === conversation.pending_expense_id) {
    return applyTextEdit(
      session,
      editing,
      source === "whatsapp_audio" ? text.replace(/[.!?…]+$/u, "") : text,
    );
  }
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
    project.canLaunch
      ? readExpense(session, project, text, logId, source)
      : // Quem só acompanha não lança: toda mensagem é pergunta.
        answerQuestion(session, project, text, {
          heard: source === "whatsapp_audio" ? heardPrefix(text) : "",
        }),
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
  const project = await projectForNewExpense(
    session,
    { pendingMedia: media, pendingLogId: logId },
    { launchOnly: true },
  );
  if (!project) return;
  await Promise.all([
    rememberActiveProject(session, project),
    readReceiptMessage(session, project, media, logId),
  ]);
}

/**
 * Obra do gasto novo (ou da pergunta): a ativa, ou a única. Com várias e
 * nenhuma ativa, pergunta qual (a mensagem fica guardada em `pending`) e
 * devolve null. Quem só acompanha recebe as obras que vê (canLaunch = false):
 * texto vira pergunta; comprovante (`launchOnly`) recebe um aviso.
 */
async function projectForNewExpense(
  session: BotSession,
  pending: ConversationContext,
  options: { launchOnly?: boolean } = {},
): Promise<BotProject | null> {
  const { admin, userId, conversation } = session;
  const projects = await listBotProjects(admin, userId);
  if (!projects.length) {
    await resetConversation(admin, userId);
    await session.send({ type: "text", body: botMessages.noProjects });
    return null;
  }
  // A lista é toda de obras em que lança ou toda de obras que só acompanha.
  const viewer = !projects[0]?.canLaunch;
  if (viewer && options.launchOnly) {
    await session.send({ type: "text", body: botMessages.viewerCannotLaunch });
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
    session.send(
      projectListMessage(
        projects,
        orgCount > 1,
        viewer ? { body: botMessages.questionWhichProject } : {},
      ),
    ),
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
 * Limite do plano e contexto da obra ao mesmo tempo. Sem chamadas de IA no
 * plano, avisa a pessoa e devolve null. O limite de lançamentos volta junto
 * (`entries`): texto pode ser pergunta, que não esbarra nele, então quem
 * chama confere depois de saber que é gasto. Comprovante é sempre gasto
 * (`requireEntries`): confere antes de baixar a foto.
 */
async function aiContextOrRefuse(
  session: BotSession,
  project: LaunchableProject,
  today: string,
  options: { requireEntries?: boolean } = {},
): Promise<{ context: ExtractionContext; entries: LimitResult } | null> {
  const [allowed, context] = await Promise.all([
    whatsappAllowance(session.admin, project.orgId, today),
    loadExtractionContext(
      session.admin,
      project.orgId,
      project.id,
      project.timezone,
    ),
  ]);
  const refused = !allowed.ai.ok
    ? allowed.ai
    : options.requireEntries && !allowed.entries.ok
      ? allowed.entries
      : null;
  if (refused && !refused.ok) {
    await refuseAi(session, refused.reason);
    return null;
  }
  return { context, entries: allowed.entries };
}

/**
 * Limite do plano antes de usar IA fora da leitura do gasto (ex.: ouvir um
 * áudio, que pode ser pergunta). Só as chamadas de IA: o limite de
 * lançamentos é conferido se o áudio for um gasto. Fora do limite, avisa a
 * pessoa e devolve false.
 */
export async function checkAiAllowed(
  session: BotSession,
  orgId: string,
  today: string,
): Promise<boolean> {
  const allowed = await canAskWhatsappQuestion(session.admin, orgId, today);
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
        : reason === "subscription_inactive"
          ? botMessages.subscriptionInactive
          : reason === "account_suspended"
            ? botMessages.accountSuspended
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
  const allowed = await aiContextOrRefuse(session, project, today);
  if (!allowed) return;
  const { context } = allowed;

  const result = await extractExpense(text, context);
  // Toda chamada conta no plano, mesmo a que falhou (tokens, se vieram).
  const usage = recordUsage(admin, project.orgId, today, {
    aiCalls: 1,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
  });

  if (result.kind === "question") {
    // Pergunta sobre os gastos: o plano já foi checado e o contexto, lido.
    await Promise.all([
      usage,
      answerQuestion(session, { ...project, canLaunch: true }, text, {
        context,
        heard,
      }),
    ]);
    return;
  }
  if (result.kind === "expense" && !allowed.entries.ok) {
    // É gasto, mas os lançamentos do mês acabaram (perguntas continuam).
    await Promise.all([usage, refuseAi(session, allowed.entries.reason)]);
    return;
  }
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
 * Baixa o comprovante. Falhou ou é grande demais: devolve `failure`, que
 * avisa a pessoa. Quem chama decide se avisa (fora do limite do plano, o
 * aviso do limite é o único que vai).
 */
async function fetchReceipt(
  media: ReceiptMedia,
): Promise<
  { file: ReceiptFile } | { failure: (s: BotSession) => Promise<void> }
> {
  const fail = (code: string, body: string) => ({
    failure: async (session: BotSession) => {
      session.noteError?.(code);
      await session.send({ type: "text", body });
    },
  });
  const declared = receiptMimeType(media.mimeType);
  if (!declared) {
    return fail("media_unsupported", botMessages.receiptUnsupported);
  }
  try {
    const file = await downloadMedia(media.id, maxReceiptBytes(declared));
    const mimeType = receiptMimeType(file.mimeType) ?? declared;
    if (file.data.byteLength > maxReceiptBytes(mimeType)) {
      throw new MediaTooLargeError(file.data.byteLength);
    }
    return { file: { data: file.data, mimeType } };
  } catch (error) {
    const tooLarge = error instanceof MediaTooLargeError;
    if (!tooLarge) console.error("[whatsapp] falha ao baixar a mídia", error);
    return tooLarge
      ? fail("media_too_large", botMessages.receiptTooLarge)
      : fail("media_download_failed", botMessages.receiptDownloadFailed);
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
  // Limite e contexto junto com o download: são independentes. Fora do
  // limite, só o aviso do limite vai (o do download fica de fora).
  const [allowed, fetched] = await Promise.all([
    aiContextOrRefuse(session, project, today, { requireEntries: true }),
    fetchReceipt(media),
  ]);
  if (!allowed) return;
  if ("failure" in fetched) return fetched.failure(session);
  const { context } = allowed;
  const { file } = fetched;

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
/** Valor do cupom chegou: os itens lidos valem se a soma bate com ele. */
function withCheckedItems(
  details: ReceiptDetails,
  amountCents: number,
): ReceiptDetails {
  const { uncheckedItems, ...rest } = details;
  if (!uncheckedItems?.length) return rest;
  return { ...rest, items: itemsMatchingTotal(uncheckedItems, amountCents) };
}

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
          ? { file, details: withCheckedItems(draft.receipt.details, cents) }
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
        session.send(
          editMenuMessage(pending.id, {
            canMove: (pending.moveTargets?.length ?? 0) > 0,
            canSplit: (pending.split?.length ?? 0) >= 2,
          }),
        ),
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
          suggestedStageName: pending.suggestedStageName,
        }),
      );
    case "stage_new":
      // O nome vem na próxima mensagem de texto (applyTextEdit).
      await Promise.all([
        setState(
          session,
          action.mode === "confirm"
            ? "awaiting_stage"
            : "awaiting_confirmation",
          pending,
          {
            editing: {
              expenseId: pending.id,
              field: "new_stage",
              mode: action.mode,
            },
          },
        ),
        session.send({ type: "text", body: botMessages.askNewStage }),
      ]);
      return;
    case "stage_suggested":
      if (!pending.suggestedStageName) {
        return session.send({ type: "text", body: botMessages.alreadyHandled });
      }
      return applyNewStage(
        session,
        pending,
        pending.suggestedStageName,
        action.mode,
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
    case "payment": {
      if (
        action.method !== null &&
        !Object.hasOwn(PAYMENT_NAMES, action.method)
      ) {
        return session.send({ type: "text", body: botMessages.alreadyHandled });
      }
      return updateAndPresent(
        session,
        pending,
        {
          payment_method: action.method as ExpenseUpdate["payment_method"],
        },
        { paymentMethod: action.method },
      );
    }
    case "invoice":
      return updateAndPresent(
        session,
        pending,
        { has_invoice: action.hasInvoice },
        { hasInvoice: action.hasInvoice },
      );
    case "move":
      return moveToProject(session, pending, action.projectId);
    case "split_no":
      return presentPending(session, pending, "new", "", { skipSplit: true });
    case "split_adjust":
      if (!pending.split?.length) {
        return session.send({
          type: "text",
          body: botMessages.splitNeedsItems,
        });
      }
      return session.send(
        splitItemsListMessage({
          expenseId: pending.id,
          items: pending.split.map((item) => ({
            id: item.id,
            description: item.description,
            stageName: stageNameOf(pending, item.stageId),
          })),
          page: action.page,
        }),
      );
    case "split_item": {
      const item = pending.split?.find((i) => i.id === action.itemId);
      if (!item) {
        return session.send({ type: "text", body: botMessages.alreadyHandled });
      }
      return session.send(
        splitStageListMessage({
          expenseId: pending.id,
          itemId: item.id,
          itemDescription: item.description,
          stages: pending.stages,
          page: action.page,
        }),
      );
    }
    case "split_stage": {
      if (
        !pending.split?.some((i) => i.id === action.itemId) ||
        (action.stageId && !pending.stages.some((s) => s.id === action.stageId))
      ) {
        return session.send({ type: "text", body: botMessages.alreadyHandled });
      }
      const updated = {
        ...pending,
        split: pending.split.map((item) =>
          item.id === action.itemId
            ? { ...item, stageId: action.stageId }
            : item,
        ),
      };
      await Promise.all([
        setState(session, "awaiting_confirmation", updated),
        session.send(splitProposal(updated)),
      ]);
      return;
    }
    case "split_do":
      return executeSplit(session, pending);
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
  field: EditField,
): Promise<void> {
  const byText = field === "description" || field === "supplier";
  await Promise.all([
    setState(
      session,
      field === "amount" ? "awaiting_amount" : "awaiting_confirmation",
      pending,
      byText ? { editing: { expenseId: pending.id, field } } : {},
    ),
    session.send(editFieldMessage(pending, field)),
  ]);
}

function editFieldMessage(
  pending: PendingExpense,
  field: EditField,
): OutgoingMessage {
  switch (field) {
    case "description":
      return {
        type: "text",
        body: botMessages.askDescription(pending.description),
      };
    case "supplier":
      return {
        type: "text",
        body: botMessages.askSupplier(pending.supplierName),
      };
    case "payment":
      return paymentListMessage(pending.id);
    case "invoice":
      return invoiceButtonsMessage(pending.id);
    case "project":
      return moveListMessage(pending.moveTargets ?? [], pending.id);
    case "split":
      return splitProposal(pending);
    case "amount":
      return { type: "text", body: botMessages.askAmount(pending.description) };
    case "stage":
      return stageListMessage({
        body: botMessages.stageEditQuestion,
        mode: "edit",
        stages: pending.stages,
        page: 0,
        expenseId: pending.id,
        suggestedStageName: pending.suggestedStageName,
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
  // Confirma primeiro: se o pendente já foi cancelado (cron, mensagem nova),
  // nada é gravado, nem o fornecedor.
  const ok = await updatePending(session, pending, {
    ...extra,
    status: "confirmed",
  });
  if (!ok) {
    return session.send({ type: "text", body: botMessages.alreadyHandled });
  }
  // A resposta sai junto com o fornecedor (só cadastrado agora, na
  // confirmação), a contagem do plano e a limpeza da conversa.
  await Promise.all([
    attachSupplier(session, pending),
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

/**
 * Cadastra (ou reaproveita) o fornecedor lido pela IA e liga ao gasto já
 * confirmado. Se falhar, o gasto continua valendo sem fornecedor: fica no
 * log e a pessoa ajusta no app.
 */
async function attachSupplier(
  session: BotSession,
  pending: PendingExpense,
): Promise<void> {
  if (!pending.supplierName) return;
  try {
    const supplierId = await resolveSupplier(
      session.admin,
      pending.orgId,
      pending.supplierName,
      pending.supplierDocument,
    );
    if (!supplierId) return;
    const { error } = await session.admin
      .from("expenses")
      .update({ supplier_id: supplierId })
      .eq("id", pending.id)
      .eq("org_id", pending.orgId)
      .eq("created_by", session.userId)
      .eq("status", "confirmed");
    if (error) throw error;
  } catch (error) {
    console.error("[whatsapp] falha ao ligar o fornecedor", error);
    session.noteError?.("supplier_failed");
  }
}

async function chooseProject(
  session: BotSession,
  projectId: string,
): Promise<void> {
  const { admin, userId, conversation } = session;
  const projects = await listBotProjects(admin, userId);
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
    if (!project.canLaunch) {
      // Quem só acompanha: o texto guardado é uma pergunta.
      return pendingText && !pendingMedia
        ? answerQuestion(session, project, pendingText, {
            heard: pendingAudio ? heardPrefix(pendingText) : "",
          })
        : session.send({ type: "text", body: botMessages.viewerCannotLaunch });
    }
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
          body: project.canLaunch
            ? botMessages.projectSelected(project.name)
            : botMessages.viewerProjectSelected(project.name),
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
  /** Outras obras da mesma conta em que a pessoa lança (Editar > Obra). */
  moveTargets?: { id: string; name: string }[];
  /** Itens do cupom com a etapa de cada um (para dividir por etapa). */
  split?: SplitItem[];
  /** Sem etapa: etapa nova sugerida pela IA ("➕ Piscina" na lista). */
  suggestedStageName?: string | null;
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
    moveTargets: projects
      .filter((p) => p.orgId === data.org_id && p.id !== data.project_id)
      .map(({ id, name }) => ({ id, name })),
    split:
      session.conversation.context.split?.expenseId === data.id
        ? session.conversation.context.split.items
        : undefined,
    suggestedStageName:
      !data.stage_id &&
      session.conversation.context.suggestedStage?.expenseId === data.id
        ? session.conversation.context.suggestedStage.name
        : null,
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
  options: { skipSplit?: boolean } = {},
): Promise<void> {
  const summary = prefix + summaryOf(pending);
  // Cupom com itens de etapas diferentes: propõe lançar um gasto por etapa.
  if (
    mode === "new" &&
    !options.skipSplit &&
    pending.split &&
    distinctStages(pending.split) >= 2
  ) {
    await Promise.all([
      setState(session, "awaiting_confirmation", pending),
      session.send(splitProposal(pending, summary)),
    ]);
    return;
  }
  // Sem etapa: pergunta (também numa obra sem etapas, se a IA sugeriu uma).
  const askStage =
    mode === "new" &&
    !pending.stageId &&
    (pending.stages.length > 0 || Boolean(pending.suggestedStageName));
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
            suggestedStageName: pending.suggestedStageName,
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
  extra: ConversationContext = {},
) {
  return saveConversation(session.admin, session.userId, {
    state,
    pendingExpenseId: pending.id,
    context: {
      ...(pending.supplierName
        ? {
            pendingSupplier: {
              expenseId: pending.id,
              name: pending.supplierName,
              document: pending.supplierDocument,
            },
          }
        : {}),
      ...(pending.split?.length
        ? { split: { expenseId: pending.id, items: pending.split } }
        : {}),
      ...(pending.suggestedStageName && !pending.stageId
        ? {
            suggestedStage: {
              expenseId: pending.id,
              name: pending.suggestedStageName,
            },
          }
        : {}),
      ...extra,
    },
  });
}

/** Tamanho máximo da descrição (o mesmo da leitura pela IA). */
const MAX_DESCRIPTION = 200;
const MAX_SUPPLIER = 120;
const NO_SUPPLIER = /^(sem|nenhum|nenhuma|nao|não|-)$/iu;

/**
 * Texto esperado por "Editar > Descrição" ou "Fornecedor". A descrição é
 * gravada no pendente; o fornecedor fica na conversa e só vira cadastro na
 * confirmação (como o lido pela IA), sem o CNPJ do comprovante, que era do
 * nome anterior.
 */
async function applyTextEdit(
  session: BotSession,
  editing: {
    expenseId: string;
    field: TextEditField;
    mode?: "confirm" | "edit";
  },
  text: string,
): Promise<void> {
  const pending = await loadPending(session, editing.expenseId);
  if (!pending) {
    await resetConversation(session.admin, session.userId);
    return session.send({ type: "text", body: botMessages.alreadyHandled });
  }
  if (editing.field === "new_stage") {
    const name = cleanStageName(text);
    if (!name) {
      return session.send({ type: "text", body: botMessages.newStageInvalid });
    }
    return applyNewStage(session, pending, name, editing.mode ?? "edit");
  }
  const value = text.replace(/\s+/g, " ").trim();
  if (editing.field === "description") {
    if (!value) {
      return session.send({
        type: "text",
        body: botMessages.askDescription(pending.description),
      });
    }
    const description = value.slice(0, MAX_DESCRIPTION);
    return updateAndPresent(session, pending, { description }, { description });
  }
  const supplierName = NO_SUPPLIER.test(value)
    ? null
    : value.slice(0, MAX_SUPPLIER) || null;
  return presentPending(
    session,
    { ...pending, supplierName, supplierDocument: null },
    "updated",
  );
}

/**
 * Etapa nova pelo bot ("➕ Nova etapa" com o nome digitado, ou a sugerida
 * pela IA): cria na obra do pendente (ou usa a que já tem esse nome) e põe o
 * gasto nela. Na primeira pergunta já confirma, como escolher uma etapa da
 * lista; no Editar, volta ao resumo. Quem chega aqui passou por loadPending,
 * que confere se a pessoa ainda lança nesta obra (a mesma regra do RLS para
 * criar etapas); o filtro por conta e obra é explícito em findOrCreateStage.
 */
async function applyNewStage(
  session: BotSession,
  pending: PendingExpense,
  name: string,
  mode: "confirm" | "edit",
): Promise<void> {
  const stage = await findOrCreateStage(
    session.admin,
    pending.orgId,
    pending.projectId,
    name,
  );
  if (!stage) {
    return session.send({ type: "text", body: botMessages.newStageFailed });
  }
  if (stage.created) {
    await session.send({
      type: "text",
      body: botMessages.stageCreated(stage.name, pending.projectName),
    });
  }
  const patch = {
    stageId: stage.id,
    stageName: stage.name,
    suggestedStageName: null,
    stages: stage.created
      ? [...pending.stages, { id: stage.id, name: stage.name }]
      : pending.stages,
  };
  if (mode === "confirm") {
    return confirm(session, { ...pending, ...patch }, { stage_id: stage.id });
  }
  return updateAndPresent(session, pending, { stage_id: stage.id }, patch);
}

/**
 * "Editar > Obra": leva o pendente para outra obra da mesma conta (o
 * comprovante, se houver, continua no caminho da conta). A etapa fica em
 * branco e a lista de etapas da obra nova é mostrada.
 */
async function moveToProject(
  session: BotSession,
  pending: PendingExpense,
  projectId: string,
): Promise<void> {
  const target = pending.moveTargets?.find((p) => p.id === projectId);
  if (!target) {
    return session.send({ type: "text", body: botMessages.alreadyHandled });
  }
  const stageRows = await stagesOf(session.admin, target.id);
  const stages = stageRows
    .filter((stage) => stage.org_id === pending.orgId)
    .map(({ id, name }) => ({ id, name }));
  const ok = await updatePending(session, pending, {
    project_id: target.id,
    stage_id: null,
  });
  if (!ok) {
    await resetConversation(session.admin, session.userId);
    return session.send({ type: "text", body: botMessages.alreadyHandled });
  }
  return presentPending(
    session,
    {
      ...pending,
      projectId: target.id,
      projectName: target.name,
      stageId: null,
      stageName: null,
      stages,
      moveTargets: undefined,
    },
    "new",
  );
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

  let itemIds: string[] = [];
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
        }).then(({ ok, itemIds }) => {
          if (!ok) session.noteError?.("receipt_save_failed");
          return itemIds;
        })
      : Promise.resolve([] as string[]),
  ]).then(([, , ids]) => {
    itemIds = ids;
  });

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
    suggestedStageName: expense.stageId
      ? null
      : (expense.suggestedStageName ?? null),
    // Itens gravados (2 ou mais): podem ser divididos por etapa. Item sem
    // etapa sugerida fica com a etapa do cupom.
    ...(receipt && itemIds.length >= 2
      ? {
          split: receipt.details.items.map((item, index) => ({
            id: itemIds[index]!,
            description: item.description,
            totalCents: item.totalCents,
            stageId: item.stageId ?? expense.stageId,
          })),
        }
      : {}),
  };
}

// Dividir a nota por etapa ------------------------------------------------------------

function stageNameOf(pending: PendingExpense, stageId: string | null): string {
  return pending.stages.find((s) => s.id === stageId)?.name ?? "Sem etapa";
}

/** Proposta de divisão (com o resumo antes, na primeira apresentação). */
function splitProposal(pending: PendingExpense, summary?: string) {
  const groups = splitGroups(pending.split ?? [], pending.amountCents);
  return splitProposalMessage({
    expenseId: pending.id,
    totalCents: pending.amountCents,
    lines: splitProposalLines(groups, (id) => stageNameOf(pending, id)),
    groupCount: groups.length,
    ...(summary ? { summary } : {}),
  });
}

/**
 * Lança um gasto por etapa: o pendente fica com a primeira etapa e as outras
 * viram gastos novos, cada um com os seus itens e uma cópia da foto. Os novos
 * nascem pendentes e todos são confirmados juntos no fim; se algo falhar no
 * caminho, os novos são cancelados, os itens voltam e nada é lançado.
 */
async function executeSplit(
  session: BotSession,
  pending: PendingExpense,
): Promise<void> {
  const { admin, userId } = session;
  const groups = splitGroups(pending.split ?? [], pending.amountCents);
  if (groups.length < 2) return session.send(splitProposal(pending));
  const [first, ...rest] = groups as [
    (typeof groups)[number],
    ...typeof groups,
  ];

  const { data: original, error: readError } = await admin
    .from("expenses")
    .select(
      "project_id, category_id, spent_on, payment_method, has_invoice, invoice_number, nfe_access_key, source, raw_input, ai_confidence",
    )
    .eq("id", pending.id)
    .eq("org_id", pending.orgId)
    .eq("created_by", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (readError) throw readError;
  if (!original) {
    await resetConversation(admin, userId);
    return session.send({ type: "text", body: botMessages.alreadyHandled });
  }

  const newIds = rest.map(() => crypto.randomUUID());
  const moved: { id: string; itemIds: string[] }[] = [];
  try {
    const { error: insertError } = await admin.from("expenses").insert(
      rest.map((group, index) => ({
        ...original,
        id: newIds[index],
        org_id: pending.orgId,
        created_by: userId,
        status: "pending" as const,
        stage_id: group.stageId,
        description: groupDescription(group.descriptions),
        amount_cents: group.amountCents,
      })),
    );
    if (insertError) throw insertError;

    for (const [index, group] of rest.entries()) {
      const { error } = await admin
        .from("expense_items")
        .update({ expense_id: newIds[index] })
        .eq("org_id", pending.orgId)
        .eq("expense_id", pending.id)
        .in("id", group.itemIds);
      if (error) throw error;
      moved.push({ id: newIds[index]!, itemIds: group.itemIds });
    }

    const firstOk = await updatePending(session, pending, {
      amount_cents: first.amountCents,
      stage_id: first.stageId,
      description: groupDescription(first.descriptions),
      quantity: null,
      unit: null,
    });
    if (!firstOk)
      throw new Error("O pendente original já não estava pendente.");
  } catch (error) {
    console.error("[whatsapp] falha ao dividir a nota", error);
    session.noteError?.("split_failed");
    // Desfaz: itens voltam para o pendente e os gastos novos são cancelados.
    await Promise.all(
      moved.map(({ itemIds }) =>
        admin
          .from("expense_items")
          .update({ expense_id: pending.id })
          .eq("org_id", pending.orgId)
          .in("id", itemIds),
      ),
    );
    await admin
      .from("expenses")
      .update({ status: "cancelled" })
      .eq("org_id", pending.orgId)
      .eq("created_by", userId)
      .in("id", newIds);
    return session.send({ type: "text", body: botMessages.splitFailed });
  }

  // A foto vai para cada gasto novo (falha só fica no log).
  const [copied, supplierId] = await Promise.all([
    copyReceipts(admin, {
      orgId: pending.orgId,
      fromExpenseId: pending.id,
      toExpenseIds: newIds,
      userId,
    }),
    pending.supplierName
      ? resolveSupplier(
          admin,
          pending.orgId,
          pending.supplierName,
          pending.supplierDocument,
        ).catch((error: unknown) => {
          console.error("[whatsapp] falha ao ligar o fornecedor", error);
          session.noteError?.("supplier_failed");
          return null;
        })
      : Promise.resolve(null),
  ]);
  if (!copied) session.noteError?.("receipt_copy_failed");

  const allIds = [pending.id, ...newIds];
  const { data: confirmed, error: confirmError } = await admin
    .from("expenses")
    .update({ status: "confirmed", supplier_id: supplierId })
    .eq("org_id", pending.orgId)
    .eq("created_by", userId)
    .eq("status", "pending")
    .in("id", allIds)
    .select("id");
  if (confirmError) throw confirmError;

  const lines = groups
    .map((group) =>
      formatSummaryLine({
        amountCents: group.amountCents,
        stageName: stageNameOf(pending, group.stageId),
        description: groupDescription(group.descriptions),
      }),
    )
    .join("\n");
  await Promise.all([
    session.send({
      type: "text",
      body: `${botMessages.splitDone(confirmed.length, lines)}\nObra: ${pending.projectName}`,
    }),
    recordUsage(admin, pending.orgId, pending.today, {
      whatsappEntries: confirmed.length,
    }),
    resetConversation(admin, userId),
  ]);
}
