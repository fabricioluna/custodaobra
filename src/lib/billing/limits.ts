import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * ÚNICO lugar onde os limites do plano são checados (CLAUDE.md, seção 3).
 * Server actions e webhook chamam estas funções; a interface nunca decide
 * sozinha o que o plano permite.
 */

type Client = SupabaseClient<Database>;

export type LimitResult =
  { ok: true } | { ok: false; reason: LimitReason; limit?: number };

export type LimitReason =
  "no_subscription" | "subscription_inactive" | "max_projects" | "max_members";

type Plan = Database["public"]["Tables"]["plans"]["Row"];

/** Regra pura: a assinatura permite usar o app agora? */
export function isSubscriptionUsable(
  subscription: {
    status: Database["public"]["Enums"]["subscription_status"];
    trial_ends_at: string | null;
  },
  now: Date = new Date(),
): boolean {
  switch (subscription.status) {
    case "active":
      return true;
    case "trialing":
      // TODO(Fase 5): bloqueio suave ao fim do teste, quando houver cobrança.
      // Até lá, os planos são provisórios e o teste vencido não bloqueia.
      return true;
    case "past_due":
      // Alguns dias de tolerância ficam para a Fase 5; por ora, não bloqueia.
      return true;
    case "cancelled":
      return (
        subscription.trial_ends_at !== null &&
        new Date(subscription.trial_ends_at) > now
      );
  }
}

/** Regra pura: dá para criar mais uma obra? */
export function checkProjectCount(
  plan: Pick<Plan, "max_projects">,
  activeProjects: number,
): LimitResult {
  if (activeProjects >= plan.max_projects) {
    return { ok: false, reason: "max_projects", limit: plan.max_projects };
  }
  return { ok: true };
}

/**
 * Regra pura: dá para convidar mais uma pessoa? Conta cada pessoa com acesso
 * uma vez (quem é convidado para uma obra também é membro da organização) e os
 * convites ainda pendentes.
 */
export function checkMemberCount(
  plan: Pick<Plan, "max_members">,
  members: number,
  pendingInvitations: number,
): LimitResult {
  if (members + pendingInvitations >= plan.max_members) {
    return { ok: false, reason: "max_members", limit: plan.max_members };
  }
  return { ok: true };
}

async function getOrgPlan(supabase: Client, orgId: string) {
  const { data } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at, plans(*)")
    .eq("org_id", orgId)
    .maybeSingle();
  return data;
}

/** Pode criar uma obra nova nesta organização? Obras arquivadas não contam. */
export async function canCreateProject(
  supabase: Client,
  orgId: string,
): Promise<LimitResult> {
  const subscription = await getOrgPlan(supabase, orgId);
  if (!subscription?.plans) return { ok: false, reason: "no_subscription" };
  if (!isSubscriptionUsable(subscription)) {
    return { ok: false, reason: "subscription_inactive" };
  }

  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("archived_at", null);
  if (error || count === null) {
    throw new Error("Não foi possível contar as obras da organização.");
  }

  return checkProjectCount(subscription.plans, count);
}

/** Pode convidar mais uma pessoa para esta organização? */
export async function canInviteMember(
  supabase: Client,
  orgId: string,
): Promise<LimitResult> {
  const subscription = await getOrgPlan(supabase, orgId);
  if (!subscription?.plans) return { ok: false, reason: "no_subscription" };
  if (!isSubscriptionUsable(subscription)) {
    return { ok: false, reason: "subscription_inactive" };
  }

  const [members, invitations] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);
  if (
    members.error ||
    members.count === null ||
    invitations.error ||
    invitations.count === null
  ) {
    throw new Error("Não foi possível contar as pessoas da organização.");
  }

  return checkMemberCount(subscription.plans, members.count, invitations.count);
}
