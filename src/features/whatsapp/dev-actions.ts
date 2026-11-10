"use server";

import { notFound } from "next/navigation";
import { refresh } from "next/cache";

import { requireUserId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { handleIncomingMessage } from "@/lib/whatsapp/handlers/incoming";
import type { IncomingMessage } from "@/lib/whatsapp/webhook";

/**
 * Simulador do bot (só em desenvolvimento): finge que a mensagem chegou do
 * WhatsApp da pessoa logada e passa pelo mesmo caminho do webhook. As
 * respostas aparecem em /dev/whatsapp, mesmo quando a Meta não as entrega.
 */

async function simulatedSender(): Promise<string> {
  if (process.env.NODE_ENV !== "development") notFound();
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("whatsapp_phone")
    .eq("id", userId)
    .single();
  if (!data?.whatsapp_phone) throw new Error("WhatsApp não ligado.");
  return data.whatsapp_phone;
}

function simulated(
  from: string,
  fields: Partial<IncomingMessage>,
): IncomingMessage {
  return {
    id: `sim.${crypto.randomUUID()}`,
    from,
    timestamp: `${Math.floor(Date.now() / 1000)}`,
    type: "text",
    ...fields,
  };
}

export async function simulateText(formData: FormData): Promise<void> {
  const from = await simulatedSender();
  const body = String(formData.get("text") ?? "").trim();
  if (!body) return;
  await handleIncomingMessage(
    createAdminClient(),
    simulated(from, { type: "text", text: { body } }),
  );
  refresh();
}

/** Toque num botão ou numa opção de lista que o bot mandou. */
export async function simulateTap(
  kind: "button" | "list",
  id: string,
  title: string,
): Promise<void> {
  const from = await simulatedSender();
  const reply = { id, title };
  await handleIncomingMessage(
    createAdminClient(),
    simulated(from, {
      type: "interactive",
      interactive:
        kind === "button"
          ? { type: "button_reply", button_reply: reply }
          : { type: "list_reply", list_reply: reply },
    }),
  );
  refresh();
}
