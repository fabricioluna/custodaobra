import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Todas as contas com plano e uso do mês (`month` = AAAA-MM-01). A função
 * do banco só responde a quem está em platform_admins; para os outros
 * devolve null (a página responde "não encontrada").
 */
export async function listAdminOrgs(month: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_orgs", { p_month: month });
  if (error) {
    if (error.code === "42501") return null;
    throw error;
  }
  return data;
}

export type AdminOrg = NonNullable<
  Awaited<ReturnType<typeof listAdminOrgs>>
>[number];
