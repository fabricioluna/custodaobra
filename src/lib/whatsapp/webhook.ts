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
  statuses: z.array(z.unknown()).optional(),
});

/** Aviso de entrega de uma mensagem que o bot mandou. */
const messageStatus = z.object({
  id: z.string(),
  status: z.string(),
  recipient_id: z.string().optional(),
  errors: z
    .array(
      z.object({
        code: z.number(),
        title: z.string().optional(),
        message: z.string().optional(),
        error_data: z.object({ details: z.string() }).optional(),
      }),
    )
    .optional(),
});

export type FailedDelivery = { waMessageId: string; error: string };

const webhookPayload = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(z.object({ field: z.string(), value: z.unknown() })),
    }),
  ),
});

/** Valores das mudanças "messages" do nosso número. */
function messageChanges(body: unknown, phoneNumberId: string) {
  const parsed = webhookPayload.safeParse(body);
  if (!parsed.success) return [];
  const values: z.infer<typeof changeValue>[] = [];
  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const value = changeValue.safeParse(change.value);
      if (!value.success) continue;
      if (value.data.metadata.phone_number_id !== phoneNumberId) continue;
      values.push(value.data);
    }
  }
  return values;
}

/**
 * Mensagens recebidas no número do bot. Mudanças de outros campos e
 * mensagens para outro número da mesma conta Business são ignoradas.
 */
export function extractMessages(
  body: unknown,
  phoneNumberId: string,
): IncomingMessage[] {
  return messageChanges(body, phoneNumberId).flatMap((v) => v.messages ?? []);
}

/**
 * Mensagens do bot que a Meta aceitou mas não conseguiu entregar. Os avisos
 * de "enviada", "entregue" e "lida" são ignorados.
 */
export function extractFailedDeliveries(
  body: unknown,
  phoneNumberId: string,
): FailedDelivery[] {
  const failures: FailedDelivery[] = [];
  for (const value of messageChanges(body, phoneNumberId)) {
    for (const raw of value.statuses ?? []) {
      const status = messageStatus.safeParse(raw);
      if (!status.success || status.data.status !== "failed") continue;
      const error = status.data.errors?.[0];
      const text = error
        ? `entrega falhou (#${error.code}) ${error.error_data?.details ?? error.message ?? error.title ?? ""}`
        : "entrega falhou";
      failures.push({
        waMessageId: status.data.id,
        error: text.trim().slice(0, 500),
      });
    }
  }
  return failures;
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
