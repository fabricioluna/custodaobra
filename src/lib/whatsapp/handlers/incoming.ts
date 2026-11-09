import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { APP_URL } from "@/config/app";
import { LOGIN_PATH } from "@/lib/auth/paths";
import type { Database, Json } from "@/types/database";

import { type OutgoingMessage, sendMessage } from "../client";
import { whatsappEnv } from "../env";
import {
  hashLinkCode,
  looksLikeLinkAttempt,
  MAX_LINK_ATTEMPTS_PER_HOUR,
  parseLinkMessage,
} from "../link-code";
import { botMessages } from "../messages";
import { phoneVariants } from "../phone";
import { type IncomingMessage, messageText } from "../webhook";

type Admin = SupabaseClient<Database>;

/** Pessoa dona do número, com a conta padrão (para o log). */
type Sender = { id: string; fullName: string | null; orgId: string | null };

const LINK_CODE_INVALID = "link_code_invalid";

/**
 * Trata uma mensagem recebida. Roda em segundo plano (after), com o cliente
 * service_role: todo filtro por pessoa e conta é explícito aqui.
 *
 * Idempotência: a mensagem é gravada primeiro no log pelo wa_message_id
 * (único). Se já existia, a Meta está reenviando e nada é feito de novo.
 */
export async function handleIncomingMessage(
  admin: Admin,
  message: IncomingMessage,
): Promise<void> {
  const variants = phoneVariants(message.from);
  const sender = await findSender(admin, variants);

  const { data: logged, error: logError } = await admin
    .from("whatsapp_messages")
    .upsert(
      {
        wa_message_id: message.id,
        direction: "in",
        from_phone: message.from,
        user_id: sender?.id ?? null,
        org_id: sender?.orgId ?? null,
        type: message.type,
        payload: message as unknown as Json,
      },
      { onConflict: "wa_message_id", ignoreDuplicates: true },
    )
    .select("id");
  if (logError) throw logError;
  const logId = logged?.[0]?.id;
  if (!logId) return; // repetida

  const finish = (fields: { error?: string | null } = {}) =>
    admin
      .from("whatsapp_messages")
      .update({ processed_at: new Date().toISOString(), ...fields })
      .eq("id", logId);

  try {
    const text = messageText(message) ?? "";
    const code = parseLinkMessage(text);

    if (code) {
      const result = await linkNumber(admin, message.from, variants, code);
      await reply(admin, message.from, sender, {
        type: "text",
        body: result.reply,
      });
      await finish({ error: result.error ?? null });
      return;
    }

    if (looksLikeLinkAttempt(text)) {
      await reply(admin, message.from, sender, {
        type: "text",
        body: botMessages.linkMalformed,
      });
      await finish();
      return;
    }

    if (!sender) {
      await reply(admin, message.from, null, {
        type: "text",
        body: botMessages.unknownNumber(`${APP_URL}${LOGIN_PATH}`),
      });
      await finish();
      return;
    }

    // Fase 3, partes 2 e 3: lançamento por texto.
    await reply(admin, message.from, sender, {
      type: "text",
      body: botMessages.comingSoon,
    });
    await finish();
  } catch (error) {
    await finish({ error: errorText(error) });
    throw error;
  }
}

async function findSender(
  admin: Admin,
  variants: string[],
): Promise<Sender | null> {
  if (!variants.length) return null;
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, default_org_id")
    .in("whatsapp_phone", variants)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { id: data.id, fullName: data.full_name, orgId: data.default_org_id }
    : null;
}

async function linkNumber(
  admin: Admin,
  phone: string,
  variants: string[],
  code: string,
): Promise<{ reply: string; error?: string }> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .in("from_phone", variants)
    .eq("error", LINK_CODE_INVALID)
    .gte("created_at", since);
  if (countError || count === null) throw countError ?? new Error("count");
  if (count >= MAX_LINK_ATTEMPTS_PER_HOUR) {
    return { reply: botMessages.linkTooManyAttempts, error: LINK_CODE_INVALID };
  }

  const { data: userId, error } = await admin.rpc("link_whatsapp", {
    p_code_hash: hashLinkCode(code, whatsappEnv("WHATSAPP_LINK_CODE_SECRET")),
    p_phone: phone,
    p_phone_variants: variants,
  });
  if (error) throw error;
  if (!userId)
    return { reply: botMessages.linkInvalid, error: LINK_CODE_INVALID };

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return { reply: botMessages.linked(firstName(profile?.full_name ?? null)) };
}

/** Manda a resposta e grava no log (direção "out"). */
async function reply(
  admin: Admin,
  to: string,
  sender: Sender | null,
  message: OutgoingMessage,
): Promise<void> {
  const waMessageId = await sendMessage(to, message);
  const { error } = await admin.from("whatsapp_messages").insert({
    wa_message_id: waMessageId ?? `out-${crypto.randomUUID()}`,
    direction: "out",
    from_phone: to,
    user_id: sender?.id ?? null,
    org_id: sender?.orgId ?? null,
    type: message.type,
    payload: message as unknown as Json,
    processed_at: new Date().toISOString(),
  });
  if (error) console.error("[whatsapp] falha ao gravar resposta no log", error);
}

function firstName(fullName: string | null): string | null {
  return fullName?.trim().split(/\s+/)[0] || null;
}

function errorText(error: unknown): string {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : String(error);
  return text.slice(0, 500);
}
