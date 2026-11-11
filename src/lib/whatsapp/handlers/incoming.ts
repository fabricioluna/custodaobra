import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { APP_URL } from "@/config/app";
import { LOGIN_PATH } from "@/lib/auth/paths";
import type { Database, Json } from "@/types/database";

import { parseAction } from "../actions";
import { parseCommand } from "../commands";
import { markReadWithTyping, type OutgoingMessage } from "../client";
import { getConversation } from "../conversation";
import { whatsappEnv } from "../env";
import {
  hashLinkCode,
  looksLikeLinkAttempt,
  MAX_LINK_ATTEMPTS_PER_HOUR,
  parseLinkMessage,
} from "../link-code";
import { botMessages } from "../messages";
import { phoneVariants } from "../phone";
import { sendAndLog } from "../send";
import { type IncomingMessage, messageText } from "../webhook";
import { handleAudio } from "./audio";
import { handleCommand } from "./commands";
import {
  type BotSession,
  handleAction,
  handleReceipt,
  handleText,
} from "./expense";

type Admin = SupabaseClient<Database>;

/** Pessoa dona do número, com a conta padrão (para o log). */
type Sender = { id: string; fullName: string | null; orgId: string | null };

const LINK_CODE_INVALID = "link_code_invalid";

/** Mensagens por número por minuto antes de o bot parar de responder. */
export const MAX_MESSAGES_PER_MINUTE = 20;
const RATE_LIMITED = "rate_limited";

/**
 * Trata uma mensagem recebida. Roda em segundo plano (after), com o cliente
 * service_role: todo filtro por pessoa e conta é explícito aqui.
 *
 * Idempotência: a mensagem é gravada primeiro no log pelo wa_message_id
 * (único). Se já existia, a Meta está reenviando e nada é feito de novo.
 *
 * Falhas (IA, Meta ou banco) nunca deixam a pessoa sem resposta: o motivo
 * fica no log da mensagem e o bot avisa que algo deu errado.
 */
export async function handleIncomingMessage(
  admin: Admin,
  message: IncomingMessage,
): Promise<void> {
  // "Digitando…" já, enquanto o resto acontece. Se falhar, só não aparece.
  const typing = markReadWithTyping(message.id).catch((error: unknown) =>
    console.error("[whatsapp] falha no 'digitando'", errorText(error)),
  );

  const variants = phoneVariants(message.from);
  let sender: Sender | null = null;
  let logId: string | undefined;
  // Motivo anotado por quem tratou a mensagem (ex.: IA fora do ar).
  let note: string | null = null;
  const finish = (error: string | null = note) =>
    admin
      .from("whatsapp_messages")
      .update({ processed_at: new Date().toISOString(), error })
      .eq("id", logId!);

  try {
    // Quem mandou e quantas mensagens o número mandou no último minuto.
    let recent: number;
    [sender, recent] = await Promise.all([
      findSender(admin, variants),
      countRecentMessages(admin, variants.length ? variants : [message.from]),
    ]);

    // A conversa é lida junto com a gravação da mensagem (uma ida a menos).
    const conversation = sender ? getConversation(admin, sender.id) : null;
    conversation?.catch(() => {});
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
    logId = logged?.[0]?.id;
    if (!logId) return; // repetida

    // Muitas mensagens seguidas: avisa uma vez e não responde mais até o
    // minuto passar (protege a IA e o plano de um envio em massa).
    if (recent >= MAX_MESSAGES_PER_MINUTE) {
      if (recent === MAX_MESSAGES_PER_MINUTE) {
        await reply(admin, message.from, sender, {
          type: "text",
          body: botMessages.rateLimited,
        });
      }
      await finish(RATE_LIMITED);
      return;
    }

    const text = messageText(message) ?? "";
    const code = parseLinkMessage(text);

    if (code) {
      const result = await linkNumber(admin, message.from, variants, code);
      // Anotado antes da resposta: se o envio falhar, a tentativa errada
      // continua contando no limite por hora.
      note = result.error ?? null;
      await reply(admin, message.from, sender, {
        type: "text",
        body: result.reply,
      });
      await finish(result.error ?? null);
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

    await handleFromSender(
      admin,
      message,
      sender,
      logId,
      conversation,
      (code) => {
        note = code;
      },
    );
    await finish();
  } catch (error) {
    console.error("[whatsapp] falha ao tratar mensagem", message.id, error);
    await reportFailure(
      admin,
      message.from,
      sender,
      logId,
      // Código de vínculo errado continua marcado (conta no limite por hora);
      // o erro de envio fica no log da resposta.
      note === LINK_CODE_INVALID ? note : errorText(error),
    );
  } finally {
    await typing;
  }
}

/**
 * Algo falhou no meio do caminho: anota no log da mensagem (se ela chegou a
 * ser gravada) e avisa a pessoa. Nada aqui lança erro de novo.
 */
async function reportFailure(
  admin: Admin,
  to: string,
  sender: Sender | null,
  logId: string | undefined,
  error: string,
): Promise<void> {
  const results = await Promise.allSettled([
    reply(admin, to, sender, { type: "text", body: botMessages.failed }),
    logId
      ? admin
          .from("whatsapp_messages")
          .update({ processed_at: new Date().toISOString(), error })
          .eq("id", logId)
          .then(({ error: updateError }) => {
            if (updateError) throw updateError;
          })
      : Promise.resolve(),
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        "[whatsapp] falha ao avisar do erro",
        errorText(result.reason),
      );
    }
  }
}

/** Mensagens recebidas do número no último minuto (para o rate limit). */
async function countRecentMessages(
  admin: Admin,
  phones: string[],
): Promise<number> {
  const since = new Date(Date.now() - 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .in("from_phone", phones)
    .eq("direction", "in")
    .gte("created_at", since);
  if (error || count === null) throw error ?? new Error("count");
  return count;
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
function reply(
  admin: Admin,
  to: string,
  sender: Sender | null,
  message: OutgoingMessage,
): Promise<void> {
  return sendAndLog(
    admin,
    to,
    { userId: sender?.id ?? null, orgId: sender?.orgId ?? null },
    message,
  );
}

/**
 * Mensagem de quem já está ligado: toque em botão ou lista (pelo id que o bot
 * mandou), foto ou documento (comprovante), áudio (transcrito e tratado como
 * texto), texto (gasto novo ou resposta a uma pergunta) ou outro tipo.
 */
async function handleFromSender(
  admin: Admin,
  message: IncomingMessage,
  sender: Sender,
  logId: string,
  conversationPromise: ReturnType<typeof getConversation> | null,
  noteError: (code: string) => void,
): Promise<void> {
  const conversation = await (conversationPromise ??
    getConversation(admin, sender.id));
  const session: BotSession = {
    admin,
    userId: sender.id,
    conversation,
    send: (outgoing: OutgoingMessage) =>
      reply(admin, message.from, sender, outgoing),
    noteError,
  };

  if (message.type === "interactive") {
    const action = parseAction(
      message.interactive?.button_reply?.id ??
        message.interactive?.list_reply?.id,
    );
    if (action) return handleAction(session, action);
    return session.send({ type: "text", body: botMessages.howTo });
  }

  // Foto do cupom, ou o cupom/nota mandado como documento (PDF ou imagem).
  const media =
    message.type === "image"
      ? message.image
      : message.type === "document"
        ? message.document
        : undefined;
  if (media) {
    return handleReceipt(
      session,
      {
        id: media.id,
        mimeType: media.mime_type ?? "",
        caption: media.caption?.trim().slice(0, 500) || null,
      },
      logId,
    );
  }

  // Mensagem de voz ou arquivo de áudio: vira texto e segue como texto.
  if (message.type === "audio" && message.audio) {
    return handleAudio(
      session,
      { id: message.audio.id, mimeType: message.audio.mime_type ?? "" },
      logId,
      sender.orgId,
    );
  }

  const text = message.type === "text" ? message.text?.body?.trim() : "";
  if (!text) return session.send({ type: "text", body: botMessages.onlyText });
  const command = parseCommand(text);
  if (command) return handleCommand(session, command);
  return handleText(session, text, logId);
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
