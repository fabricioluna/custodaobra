import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Fornecedor pelo nome: usa o que já existe na organização (sem diferenciar
 * maiúsculas) ou cria um novo. Usado nos gastos e nas contas a pagar.
 *
 * Com o CNPJ/CPF (lido de um comprovante, já conferido), procura antes por
 * ele, e o grava no cadastro achado pelo nome que ainda não tinha.
 */
export async function resolveSupplier(
  supabase: SupabaseClient<Database>,
  orgId: string,
  name: string | null,
  document: string | null = null,
): Promise<string | null> {
  if (!name) return null;

  if (document) {
    const byDocument = await supabase
      .from("suppliers")
      .select("id")
      .eq("org_id", orgId)
      .eq("document", document)
      .limit(1)
      .maybeSingle();
    if (byDocument.data) return byDocument.data.id;
  }

  const pattern = name.replace(/[\\%_]/g, (c) => `\\${c}`);
  const find = () =>
    supabase
      .from("suppliers")
      .select("id, document")
      .eq("org_id", orgId)
      .ilike("name", pattern)
      .limit(1)
      .maybeSingle();

  const existing = await find();
  if (existing.data) {
    if (document && !existing.data.document) {
      const { error } = await supabase
        .from("suppliers")
        .update({ document })
        .eq("id", existing.data.id)
        .eq("org_id", orgId);
      // Sem o documento o cadastro continua valendo.
      if (error) console.error("[fornecedor] documento não gravado", error);
    }
    return existing.data.id;
  }

  const created = await supabase
    .from("suppliers")
    .insert({ org_id: orgId, name, document })
    .select("id")
    .single();
  if (created.data) return created.data.id;
  // Alguém criou o mesmo nome ao mesmo tempo (índice único): usa o dele.
  if (created.error?.code === "23505") return (await find()).data?.id ?? null;
  return null;
}
