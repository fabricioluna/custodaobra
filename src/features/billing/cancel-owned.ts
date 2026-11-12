import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AsaasError,
  deleteSubscription,
  isAsaasConfigured,
} from "@/lib/billing/asaas";
import type { Database } from "@/types/database";

/**
 * Antes de excluir a conta de uma pessoa: remove no Asaas as assinaturas das
 * contas de que ela é dona, para a cobrança não continuar depois que tudo
 * sumir. Falhou, para antes de apagar qualquer coisa.
 */
export async function cancelOwnedSubscriptions(
  supabase: SupabaseClient<Database>,
  orgIds: string[],
): Promise<void> {
  if (!orgIds.length) return;
  const { data, error } = await supabase
    .from("subscriptions")
    .select("provider_subscription_id")
    .in("org_id", orgIds)
    .eq("provider", "asaas")
    .not("provider_subscription_id", "is", null);
  if (error) throw error;
  if (!data.length) return;
  if (!isAsaasConfigured()) {
    throw new Error("assinatura no Asaas sem ASAAS_API_KEY para cancelar");
  }
  for (const { provider_subscription_id: id } of data) {
    try {
      await deleteSubscription(id!);
    } catch (error) {
      if (!(error instanceof AsaasError && error.status === 404)) throw error;
    }
  }
}
