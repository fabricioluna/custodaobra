import "server-only";

import { overrideStatus } from "@/lib/billing/limits";
import { createClient } from "@/lib/supabase/server";

/** Planos que dá para assinar (ativos e com preço). */
export async function getPaidPlans() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("code, name, price_cents_month, max_projects, max_members")
    .eq("active", true)
    .gt("price_cents_month", 0)
    .order("price_cents_month");
  if (error) throw error;
  return data;
}

/** A assinatura da conta como o Asaas a vê (dono e admin). */
export async function getBillingSubscription(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "status, plan_code, trial_ends_at, current_period_end, provider_customer_id, provider_subscription_id, provider_plan_code, access_override, access_override_at",
    )
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * A equipe decidiu o acesso da conta (liberou ou suspendeu)? Nesse caso a
 * assinatura pelo app não vale: liberada não precisa pagar, e pagar não tira
 * a suspensão.
 */
export function teamManagedAccess(subscription: {
  access_override: Parameters<typeof overrideStatus>[0];
  access_override_at: string | null;
}): "granted" | "suspended" | null {
  const status = overrideStatus(
    subscription.access_override,
    subscription.access_override_at,
  );
  return status === "granted" || status === "suspended" ? status : null;
}
