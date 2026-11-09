import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Fornecedor pelo nome: usa o que já existe na organização (sem diferenciar
 * maiúsculas) ou cria um novo. Usado nos gastos e nas contas a pagar.
 */
export async function resolveSupplier(
  supabase: SupabaseClient<Database>,
  orgId: string,
  name: string | null,
): Promise<string | null> {
  if (!name) return null;
  const pattern = name.replace(/[\\%_]/g, (c) => `\\${c}`);
  const find = () =>
    supabase
      .from("suppliers")
      .select("id")
      .eq("org_id", orgId)
      .ilike("name", pattern)
      .limit(1)
      .maybeSingle();

  const existing = await find();
  if (existing.data) return existing.data.id;

  const created = await supabase
    .from("suppliers")
    .insert({ org_id: orgId, name })
    .select("id")
    .single();
  if (created.data) return created.data.id;
  // Alguém criou o mesmo nome ao mesmo tempo (índice único): usa o dele.
  if (created.error?.code === "23505") return (await find()).data?.id ?? null;
  return null;
}
