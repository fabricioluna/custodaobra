import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { monthOf } from "./limits";

/**
 * Soma ao uso do mês da organização (usage_counters). Só o servidor pode:
 * a função do banco é liberada apenas para o service_role. Toda chamada à IA
 * passa por aqui, com os tokens gastos (CLAUDE.md, seção 7).
 */
export async function recordUsage(
  admin: SupabaseClient<Database>,
  orgId: string,
  today: string,
  usage: {
    whatsappEntries?: number;
    aiCalls?: number;
    inputTokens?: number;
    outputTokens?: number;
  },
): Promise<void> {
  const { error } = await admin.rpc("increment_usage", {
    p_org_id: orgId,
    p_month: monthOf(today),
    p_whatsapp_entries: usage.whatsappEntries ?? 0,
    p_ai_calls: usage.aiCalls ?? 0,
    p_ai_input_tokens: usage.inputTokens ?? 0,
    p_ai_output_tokens: usage.outputTokens ?? 0,
  });
  if (error) {
    // Não derruba o lançamento por causa da contagem, mas deixa rastro.
    console.error("[uso] falha ao registrar", orgId, error.message);
  }
}
