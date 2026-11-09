import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

/**
 * Assinatura que a Meta manda em `X-Hub-Signature-256`: "sha256=" + HMAC
 * SHA-256 do corpo bruto com o App Secret. Confere em tempo constante.
 */
export function verifySignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): boolean {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const received = Buffer.from(header.slice("sha256=".length), "hex");
  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest();
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

/** Verificação do GET: devolve o challenge se o token bater; senão, null. */
export function verifySubscription(
  params: URLSearchParams,
  verifyToken: string,
): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode !== "subscribe" || !verifyToken || !challenge) return null;
  const a = Buffer.from(token ?? "");
  const b = Buffer.from(verifyToken);
  return a.length === b.length && timingSafeEqual(a, b) ? challenge : null;
}

// Payload --------------------------------------------------------------------
// Só o que usamos; o resto passa sem validação (o objeto inteiro vai para o log).

const media = z.object({
  id: z.string(),
  mime_type: z.string().optional(),
  caption: z.string().optional(),
});

const incomingMessage = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  interactive: z
    .object({
      type: z.string(),
      button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
      list_reply: z.object({ id: z.string(), title: z.string() }).optional(),
    })
    .optional(),
  button: z.object({ payload: z.string(), text: z.string() }).optional(),
  image: media.optional(),
  audio: media.optional(),
  document: media.optional(),
});

export type IncomingMessage = z.infer<typeof incomingMessage>;

const changeValue = z.object({
  messaging_product: z.literal("whatsapp").optional(),
  metadata: z.object({ phone_number_id: z.string() }),
  contacts: z
    .array(
      z.object({
        wa_id: z.string(),
        profile: z.object({ name: z.string() }).optional(),
      }),
    )
    .optional(),
  messages: z.array(incomingMessage).optional(),
});

const webhookPayload = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(z.object({ field: z.string(), value: z.unknown() })),
    }),
  ),
});

/**
 * Mensagens recebidas no número do bot. Avisos de entrega e leitura
 * (`statuses`) e mudanças de outros campos são ignorados, assim como
 * mensagens para outro número da mesma conta Business.
 */
export function extractMessages(
  body: unknown,
  phoneNumberId: string,
): IncomingMessage[] {
  const parsed = webhookPayload.safeParse(body);
  if (!parsed.success) return [];

  const messages: IncomingMessage[] = [];
  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const value = changeValue.safeParse(change.value);
      if (!value.success) continue;
      if (value.data.metadata.phone_number_id !== phoneNumberId) continue;
      messages.push(...(value.data.messages ?? []));
    }
  }
  return messages;
}

/** Texto que a pessoa mandou (mensagem, legenda ou título do botão tocado). */
export function messageText(message: IncomingMessage): string | null {
  return (
    message.text?.body ??
    message.interactive?.button_reply?.title ??
    message.interactive?.list_reply?.title ??
    message.button?.text ??
    message.image?.caption ??
    null
  );
}
