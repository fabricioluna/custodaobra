"use server";

import { refresh } from "next/cache";

import { requireUserId } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { whatsappEnv } from "@/lib/whatsapp/env";
import {
  generateLinkCode,
  hashLinkCode,
  linkMessage,
} from "@/lib/whatsapp/link-code";

import { whatsappCopy } from "./copy";
import { botNumber } from "./queries";

export type LinkCodeState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "success";
      code: string;
      message: string;
      expiresAt: string;
      waLink: string | null;
    };

/**
 * Gera o código de 6 dígitos (vale 15 minutos) e o link wa.me com a mensagem
 * pronta. Apaga os códigos anteriores ainda não usados. O código só aparece
 * aqui, uma vez; o banco guarda o HMAC.
 */
export async function createLinkCode(): Promise<LinkCodeState> {
  const userId = await requireUserId();
  const supabase = await createClient();
  const secret = whatsappEnv("WHATSAPP_LINK_CODE_SECRET");

  await supabase
    .from("whatsapp_link_codes")
    .delete()
    .eq("user_id", userId)
    .is("used_at", null);

  // Dois códigos ativos iguais são raros, mas o índice único barra: tenta outro.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateLinkCode();
    const { data, error } = await supabase
      .from("whatsapp_link_codes")
      .insert({ user_id: userId, code_hash: hashLinkCode(code, secret) })
      .select("expires_at")
      .single();
    if (error?.code === "23505") continue;
    if (error || !data) break;

    const message = linkMessage(code);
    const bot = botNumber();
    return {
      status: "success",
      code,
      message,
      expiresAt: data.expires_at,
      waLink: bot
        ? `https://wa.me/${bot}?text=${encodeURIComponent(message)}`
        : null,
    };
  }
  return { status: "error", message: whatsappCopy.errors.failed };
}

export async function unlinkWhatsapp(): Promise<FormState<never>> {
  await requireUserId();
  const supabase = await createClient();
  const { error } = await supabase.rpc("unlink_whatsapp");
  if (error) {
    return { status: "error", message: whatsappCopy.errors.unlinkFailed };
  }
  refresh();
  return { status: "success" };
}

/** "Já enviei": recarrega a tela para ver se o número já foi ligado. */
export async function refreshWhatsapp(): Promise<void> {
  await requireUserId();
  refresh();
}
