import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database";

import { type OutgoingMessage, sendMessage } from "./client";

/** Manda a mensagem e grava no log (direção "out"). */
export async function sendAndLog(
  admin: SupabaseClient<Database>,
  to: string,
  who: { userId: string | null; orgId: string | null },
  message: OutgoingMessage,
): Promise<void> {
  let waMessageId: string | null = null;
  let sendError: unknown = null;
  try {
    waMessageId = await sendMessage(to, message);
  } catch (error) {
    sendError = error;
  }
  // A resposta vai para o log mesmo quando a Meta recusa, com o motivo.
  const { error } = await admin.from("whatsapp_messages").insert({
    wa_message_id: waMessageId ?? `out-${crypto.randomUUID()}`,
    direction: "out",
    from_phone: to,
    user_id: who.userId,
    org_id: who.orgId,
    type: message.type,
    payload: message as unknown as Json,
    processed_at: new Date().toISOString(),
    error: sendError ? describeSendError(sendError) : null,
  });
  if (error) console.error("[whatsapp] falha ao gravar resposta no log", error);
  if (sendError) throw sendError;
}

function describeSendError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return `send_failed: ${text}`.slice(0, 500);
}
