import "server-only";

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
      "status, plan_code, trial_ends_at, current_period_end, provider_customer_id, provider_subscription_id, provider_plan_code",
    )
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
