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
  const waMessageId = await sendMessage(to, message);
  const { error } = await admin.from("whatsapp_messages").insert({
    wa_message_id: waMessageId ?? `out-${crypto.randomUUID()}`,
    direction: "out",
    from_phone: to,
    user_id: who.userId,
    org_id: who.orgId,
    type: message.type,
    payload: message as unknown as Json,
    processed_at: new Date().toISOString(),
  });
  if (error) console.error("[whatsapp] falha ao gravar resposta no log", error);
}
