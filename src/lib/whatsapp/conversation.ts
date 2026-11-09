import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExtractedExpense } from "@/lib/ai/extract-expense";
import type { Database, Json } from "@/types/database";

type Admin = SupabaseClient<Database>;
type ConversationRow =
  Database["public"]["Tables"]["whatsapp_conversations"]["Row"];
export type ConversationState =
  Database["public"]["Enums"]["whatsapp_conversation_state"];

/** Gasto lido pela IA que ainda não tem valor (o banco exige valor). */
export type ExpenseDraft = {
  projectId: string;
  expense: ExtractedExpense;
  rawInput: string;
  logId: string | null;
};

export type ConversationContext = {
  /** Mensagem guardada enquanto a pessoa escolhe a obra. */
  pendingText?: string;
  pendingLogId?: string | null;
  draft?: ExpenseDraft;
};

export type Conversation = Omit<ConversationRow, "context"> & {
  context: ConversationContext;
};

/** Estado da conversa da pessoa (cria na primeira mensagem). */
export async function getConversation(
  admin: Admin,
  userId: string,
): Promise<Conversation> {
  await admin
    .from("whatsapp_conversations")
    .upsert(
      { user_id: userId },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  const { data, error } = await admin
    .from("whatsapp_conversations")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
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
        ? { context: patch.context as unknown as Json }
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
