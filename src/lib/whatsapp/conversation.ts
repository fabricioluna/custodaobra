import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExtractedExpense } from "@/lib/ai/extract-expense";
import type { ReceiptDetails } from "@/lib/ai/read-receipt";
import type { Database, Json } from "@/types/database";

type Admin = SupabaseClient<Database>;
type ConversationRow =
  Database["public"]["Tables"]["whatsapp_conversations"]["Row"];
/** Origens dos lançamentos que chegam pelo WhatsApp. */
export const WHATSAPP_SOURCES: Database["public"]["Enums"]["expense_source"][] =
  ["whatsapp_text", "whatsapp_audio", "whatsapp_image"];

export type ConversationState =
  Database["public"]["Enums"]["whatsapp_conversation_state"];

/** Foto ou PDF de comprovante recebido (a mídia fica na Meta por 30 dias). */
export type ReceiptMedia = {
  id: string;
  mimeType: string;
  caption: string | null;
};

/** Gasto lido pela IA que ainda não tem valor (o banco exige valor). */
export type ExpenseDraft = {
  projectId: string;
  expense: ExtractedExpense;
  rawInput: string | null;
  logId: string | null;
  /** Veio de um áudio (o texto é a transcrição). */
  audio?: boolean;
  /** Veio de um comprovante: a foto é baixada de novo quando o valor chega. */
  receipt?: { media: ReceiptMedia; details: ReceiptDetails };
};

export type ConversationContext = {
  /** Mensagem guardada enquanto a pessoa escolhe a obra. */
  pendingText?: string;
  /** `pendingText` é a transcrição de um áudio. */
  pendingAudio?: boolean;
  /** Comprovante guardado enquanto a pessoa escolhe a obra. */
  pendingMedia?: ReceiptMedia;
  pendingLogId?: string | null;
  /** Comando à espera da escolha da obra (ex.: "resumo" com várias obras). */
  pendingCommand?: "summary";
  draft?: ExpenseDraft;
  /**
   * Fornecedor lido pela IA para o gasto pendente. Só vira cadastro em
   * `suppliers` quando a pessoa confirma: se ela cancela, nada sobra.
   */
  pendingSupplier?: {
    expenseId: string;
    name: string;
    /** CNPJ ou CPF lido do comprovante, já conferido. */
    document?: string | null;
  };
};

/** Mantém o fornecedor do pendente ao trocar o resto do contexto. */
export function keepPendingSupplier(
  context: ConversationContext,
): ConversationContext {
  return context.pendingSupplier
    ? { pendingSupplier: context.pendingSupplier }
    : {};
}

export type Conversation = Omit<ConversationRow, "context"> & {
  context: ConversationContext;
};

/** Estado da conversa da pessoa (cria na primeira mensagem). */
export async function getConversation(
  admin: Admin,
  userId: string,
): Promise<Conversation> {
  // Quase sempre já existe: lê primeiro e só cria se faltar.
  const read = () =>
    admin
      .from("whatsapp_conversations")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
  let { data, error } = await read();
  if (!error && !data) {
    await admin
      .from("whatsapp_conversations")
      .upsert(
        { user_id: userId },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    ({ data, error } = await read());
  }
  if (error) throw error;
  if (!data) throw new Error("Conversa não encontrada.");
  const context =
    data.context &&
    typeof data.context === "object" &&
    !Array.isArray(data.context)
      ? (data.context as ConversationContext)
      : {};
  return { ...data, context };
}

export async function saveConversation(
  admin: Admin,
  userId: string,
  patch: {
    state?: ConversationState;
    pendingExpenseId?: string | null;
    activeOrgId?: string | null;
    activeProjectId?: string | null;
    context?: ConversationContext;
  },
): Promise<void> {
  const { error } = await admin
    .from("whatsapp_conversations")
    .update({
      ...(patch.state !== undefined ? { state: patch.state } : {}),
      ...(patch.pendingExpenseId !== undefined
        ? { pending_expense_id: patch.pendingExpenseId }
        : {}),
      ...(patch.activeOrgId !== undefined
        ? { active_org_id: patch.activeOrgId }
        : {}),
      ...(patch.activeProjectId !== undefined
        ? { active_project_id: patch.activeProjectId }
        : {}),
      ...(patch.context !== undefined
        ? { context: patch.context as unknown as NonNullable<Json> }
        : {}),
    })
    .eq("user_id", userId);
  if (error) throw error;
}

/** Volta ao começo: sem gasto pendente nem rascunho. */
export function resetConversation(admin: Admin, userId: string) {
  return saveConversation(admin, userId, {
    state: "idle",
    pendingExpenseId: null,
    context: {},
  });
}
