"use server";

import { redirect } from "next/navigation";

import { LOGIN_PATH, safeNextPath } from "@/lib/auth/paths";
import { getRequestOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";

import { authCopy } from "./copy";
import { sendCodeSchema, verifyCodeSchema } from "./schemas";

const { errors } = authCopy;

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

export type SendCodeState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; email: string };

/** Envia o e-mail de acesso (código + link). Cria a conta se for nova. */
export async function sendEmailCode(
  _prev: SendCodeState,
  formData: FormData,
): Promise<SendCodeState> {
  const raw = {
    email: field(formData, "email"),
    next: field(formData, "next"),
  };
  const parsed = sendCodeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: errors.invalidEmail,
      email: raw.email ?? "",
    };
  }

  const { email } = parsed.data;
  const next = safeNextPath(parsed.data.next);
  const origin = await getRequestOrigin();
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      // O modelo de e-mail usa {{ .RedirectTo }} para montar o link de acesso.
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return {
      status: "error",
      message: error.status === 429 ? errors.rateLimited : errors.sendFailed,
      email,
    };
  }
  return { status: "sent", email };
}

export type VerifyCodeState =
  { status: "idle" } | { status: "error"; message: string };

/** Confere o código digitado e abre a sessão. */
export async function verifyEmailCode(
  _prev: VerifyCodeState,
  formData: FormData,
): Promise<VerifyCodeState> {
  const parsed = verifyCodeSchema.safeParse({
    email: field(formData, "email"),
    token: field(formData, "token"),
    next: field(formData, "next"),
  });
  if (!parsed.success) {
    return { status: "error", message: errors.invalidCode };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });
  if (error) {
    return {
      status: "error",
      message: error.status === 429 ? errors.rateLimited : errors.wrongCode,
    };
  }

  redirect(safeNextPath(parsed.data.next));
}

/** Leva para a tela de login do Google; a volta cai em /auth/callback. */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNextPath(field(formData, "next"));
  const origin = await getRequestOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) redirect(`${LOGIN_PATH}?erro=google`);
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
