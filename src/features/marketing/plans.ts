import { createClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";

import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export type PublicPlan = Pick<
  Database["public"]["Tables"]["plans"]["Row"],
  | "code"
  | "name"
  | "max_projects"
  | "max_members"
  | "whatsapp_enabled"
  | "max_whatsapp_entries_month"
  | "price_cents_month"
  | "trial_days"
>;

/**
 * Planos ativos para a página de preços, lidos da tabela `plans` (leitura
 * pública) com a chave anônima, sem sessão. Fica em cache por horas: mudar o
 * preço no banco aparece na página sem novo deploy. Sem banco (build do CI,
 * falha de rede), devolve lista vazia e a página mostra um aviso no lugar.
 */
export async function getPublicPlans(): Promise<PublicPlan[]> {
  "use cache";
  try {
    const supabase = createClient<Database>(
      getSupabaseUrl(),
      getSupabasePublishableKey(),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase
      .from("plans")
      .select(
        "code, name, max_projects, max_members, whatsapp_enabled, max_whatsapp_entries_month, price_cents_month, trial_days",
      )
      .eq("active", true)
      .order("price_cents_month")
      .order("max_projects");
    if (error) throw error;
    cacheLife("hours");
    return data;
  } catch (error) {
    console.error("[preços] não consegui ler os planos", error);
    // Falha não fica guardada por horas: tenta de novo logo.
    cacheLife("minutes");
    return [];
  }
}
