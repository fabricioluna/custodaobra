import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { LOGIN_PATH } from "./paths";

/**
 * Camada de acesso à sessão. Toda leitura do usuário logado passa por aqui.
 * `cache` evita validar a sessão mais de uma vez na mesma requisição.
 */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
});

/** Id do usuário logado; sem sessão, manda para o login. */
export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect(LOGIN_PATH);
  return userId;
}
