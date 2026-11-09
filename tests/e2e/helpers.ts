import type { Page } from "@playwright/test";

import { adminClient } from "../rls/helpers";

export type E2EUser = { id: string; email: string; orgId: string };

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Cria uma conta nova como se a pessoa tivesse entrado pelo e-mail pela
 * primeira vez (sem nome): o gatilho de cadastro cria perfil, organização
 * pessoal e assinatura.
 */
export async function createE2EUser(label: string): Promise<E2EUser> {
  const admin = adminClient();
  const email = `e2e-${label}-${runId}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Usuário não criado");

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("default_org_id")
    .eq("id", data.user.id)
    .single();
  if (profileError || !profile.default_org_id) {
    throw profileError ?? new Error("Organização pessoal não criada");
  }
  return { id: data.user.id, email, orgId: profile.default_org_id };
}

/**
 * Entra como a pessoa sem passar pela caixa de e-mail: gera o mesmo link de
 * acesso que o e-mail traria e abre direto a rota que o confere.
 */
export async function signIn(page: Page, user: E2EUser, next = "/inicio") {
  const { data, error } = await adminClient().auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (error) throw error;
  const params = new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
    next,
  });
  await page.goto(`/auth/confirm?${params.toString()}`);
}

/** Apaga as contas de teste e as organizações pessoais delas. */
export async function deleteE2EUsers(users: E2EUser[]) {
  const admin = adminClient();
  for (const user of users) {
    await admin.auth.admin.deleteUser(user.id);
    await admin.from("organizations").delete().eq("id", user.orgId);
  }
}
