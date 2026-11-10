import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { todayIn } from "@/lib/dates";
import type { Database } from "@/types/database";

import type { ExtractionContext } from "./extract-expense";

const RECENT_SUPPLIERS = 20;

/**
 * Contexto da extração para uma obra: hoje no fuso da organização, as etapas
 * (na ordem da obra) e os últimos fornecedores usados. Roda com o cliente
 * service_role (webhook), então todo filtro por org_id é explícito.
 */
export async function loadExtractionContext(
  admin: SupabaseClient<Database>,
  orgId: string,
  projectId: string,
  timezone: string,
): Promise<ExtractionContext> {
  const [stages, recent] = await Promise.all([
    admin
      .from("stages")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("project_id", projectId)
      .order("sort_order"),
    admin
      .from("expenses")
      .select("suppliers(name)")
      .eq("org_id", orgId)
      .not("supplier_id", "is", null)
      // Só gastos confirmados: um nome mal lido num pendente cancelado não
      // volta para a IA como "fornecedor recente".
      .eq("status", "confirmed")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (stages.error) throw stages.error;
  if (recent.error) throw recent.error;

  const suppliers: string[] = [];
  for (const row of recent.data) {
    const name = row.suppliers?.name;
    if (name && !suppliers.includes(name)) suppliers.push(name);
    if (suppliers.length >= RECENT_SUPPLIERS) break;
  }

  return { today: todayIn(timezone), stages: stages.data, suppliers };
}
