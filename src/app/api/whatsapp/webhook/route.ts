import { after, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { whatsappEnv } from "@/lib/whatsapp/env";
import { handleIncomingMessage } from "@/lib/whatsapp/handlers/incoming";
import {
  extractFailedDeliveries,
  extractMessages,
  verifySignature,
  verifySubscription,
} from "@/lib/whatsapp/webhook";

/**
 * Webhook da WhatsApp Cloud API.
 * GET: verificação feita pela Meta ao cadastrar a URL.
 * POST: mensagens. A assinatura é conferida antes de tudo; a resposta 200 sai
 * na hora e o processamento segue em segundo plano (after), porque a Meta
 * reenvia o que demora a ser confirmado.
 */

/**
 * Tempo máximo da função, contando o after(): a IA tem 20 s com uma nova
 * tentativa no texto e 45 s na foto do cupom (mais até 15 s para baixar a
 * foto da Meta); o resto (banco e Meta) leva poucos segundos.
 */
export const maxDuration = 90;

export function GET(request: NextRequest) {
  const challenge = verifySubscription(
    request.nextUrl.searchParams,
    process.env.WHATSAPP_VERIFY_TOKEN ?? "",
  );
  if (challenge === null) return new Response("Forbidden", { status: 403 });
  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const valid = verifySignature(
    rawBody,
    request.headers.get("x-hub-signature-256"),
    process.env.WHATSAPP_APP_SECRET ?? "",
  );
  if (!valid) return new Response("Invalid signature", { status: 401 });

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const phoneNumberId = whatsappEnv("WHATSAPP_PHONE_NUMBER_ID");
  const messages = extractMessages(body, phoneNumberId);
  const failures = extractFailedDeliveries(body, phoneNumberId);
  if (messages.length || failures.length) {
    after(async () => {
      const admin = createAdminClient();
      // Uma por vez, na ordem em que chegaram.
      for (const message of messages) {
        // Erros viram resposta à pessoa e ficam no log lá dentro.
        await handleIncomingMessage(admin, message);
      }
      // Resposta do bot que não chegou: fica anotada no log.
      for (const failure of failures) {
        console.error("[whatsapp]", failure.waMessageId, failure.error);
        await admin
          .from("whatsapp_messages")
          .update({ error: failure.error })
          .eq("wa_message_id", failure.waMessageId)
          .eq("direction", "out");
      }
    });
  }

  return new Response("OK", { status: 200 });
}
