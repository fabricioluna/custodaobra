import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Todas as contas com plano e uso do mês (`month` = AAAA-MM-01). A função
 * do banco só responde a quem está em platform_admins; para os outros
 * devolve null (a página responde "não encontrada").
 */
export async function listAdminOrgs(month: string, orgId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_orgs", {
    p_month: month,
    p_org_id: orgId,
  });
  if (error) {
    if (error.code === "42501") return null;
    throw error;
  }
  return data;
}

export type AdminOrg = NonNullable<
  Awaited<ReturnType<typeof listAdminOrgs>>
>[number];

/** Uma conta do painel (com o uso do mês atual), ou null se não houver. */
export async function getAdminOrg(orgId: string, month: string) {
  const orgs = await listAdminOrgs(month, orgId);
  return orgs?.[0] ?? null;
}

/** Planos que a equipe pode dar a uma conta. */
export async function listActivePlans() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("code, name")
    .eq("active", true)
    .order("price_cents_month");
  if (error) throw error;
  return data;
}
