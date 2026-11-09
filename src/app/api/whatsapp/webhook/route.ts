import { after, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { whatsappEnv } from "@/lib/whatsapp/env";
import { handleIncomingMessage } from "@/lib/whatsapp/handlers/incoming";
import {
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

  const messages = extractMessages(
    body,
    whatsappEnv("WHATSAPP_PHONE_NUMBER_ID"),
  );
  if (messages.length) {
    after(async () => {
      const admin = createAdminClient();
      // Uma por vez, na ordem em que chegaram.
      for (const message of messages) {
        try {
          await handleIncomingMessage(admin, message);
        } catch (error) {
          console.error(
            "[whatsapp] falha ao tratar mensagem",
            message.id,
            error,
          );
        }
      }
    });
  }

  return new Response("OK", { status: 200 });
}
