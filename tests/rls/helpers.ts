import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

function firstOf(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(
    `Defina uma destas variáveis para os testes de RLS: ${names.join(", ")}`,
  );
}

/** Aceita os nomes do .env.local e os do `supabase status -o env` (CI). */
export const supabaseUrl = () =>
  firstOf("API_URL", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = () =>
  firstOf("PUBLISHABLE_KEY", "ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
const secretKey = () =>
  firstOf("SECRET_KEY", "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Cliente com a chave secreta: só para preparar e limpar os testes. */
export function adminClient(): Client {
  return createClient<Database>(supabaseUrl(), secretKey(), noSession);
}

/** Cliente sem login (visitante). */
export function anonClient(): Client {
  return createClient<Database>(supabaseUrl(), publishableKey(), noSession);
}

export type TestUser = {
  id: string;
  email: string;
  orgId: string;
  client: Client;
};

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Cria um usuário de teste (o gatilho de cadastro cria perfil, organização e
 * assinatura) e devolve um cliente logado como ele.
 */
export async function createTestUser(label: string): Promise<TestUser> {
  const admin = adminClient();
  const email = `rls-${label}-${runId}@example.com`;
  const password = `Teste-${crypto.randomUUID()}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Teste RLS ${label}` },
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

  const client = createClient<Database>(
    supabaseUrl(),
    publishableKey(),
    noSession,
  );
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;

  return { id: data.user.id, email, orgId: profile.default_org_id, client };
}

/** Apaga os usuários e as organizações pessoais deles. */
export async function deleteTestUsers(users: TestUser[]): Promise<void> {
  const admin = adminClient();
  for (const user of users) {
    await user.client.auth.signOut();
    await admin.auth.admin.deleteUser(user.id);
    await admin.from("organizations").delete().eq("id", user.orgId);
  }
}
