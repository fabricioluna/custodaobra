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
  | "no_subscription"
  | "subscription_inactive"
  | "max_projects"
  | "max_members"
  | "whatsapp_disabled"
  | "max_whatsapp_entries"
  | "max_ai_calls";

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

/** Regra pura: dá para lançar mais um gasto pelo WhatsApp este mês? */
export function checkWhatsappEntries(
  plan: Pick<Plan, "whatsapp_enabled" | "max_whatsapp_entries_month">,
  usedThisMonth: number,
): LimitResult {
  if (!plan.whatsapp_enabled) return { ok: false, reason: "whatsapp_disabled" };
  if (usedThisMonth >= plan.max_whatsapp_entries_month) {
    return {
      ok: false,
      reason: "max_whatsapp_entries",
      limit: plan.max_whatsapp_entries_month,
    };
  }
  return { ok: true };
}

/** Regra pura: dá para chamar a IA mais uma vez este mês? */
export function checkAiCalls(
  plan: Pick<Plan, "max_ai_calls_month">,
  usedThisMonth: number,
): LimitResult {
  if (usedThisMonth >= plan.max_ai_calls_month) {
    return {
      ok: false,
      reason: "max_ai_calls",
      limit: plan.max_ai_calls_month,
    };
  }
  return { ok: true };
}

/** Primeiro dia do mês (AAAA-MM-01) de uma data AAAA-MM-DD. */
export function monthOf(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
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

async function getUsage(supabase: Client, orgId: string, month: string) {
  const { data, error } = await supabase
    .from("usage_counters")
    .select("whatsapp_entries, ai_calls")
    .eq("org_id", orgId)
    .eq("month", month)
    .maybeSingle();
  if (error) throw new Error("Não foi possível ler o uso do plano.");
  return data ?? { whatsapp_entries: 0, ai_calls: 0 };
}

/**
 * Pode lançar mais um gasto pelo WhatsApp e chamar a IA para lê-lo? Usado
 * pelo webhook (cliente service_role, sem sessão). `today` é a data no fuso
 * da organização: o mês do plano vira no fuso dela.
 */
export async function canUseWhatsappAi(
  supabase: Client,
  orgId: string,
  today: string,
): Promise<LimitResult> {
  const [subscription, usage] = await Promise.all([
    getOrgPlan(supabase, orgId),
    getUsage(supabase, orgId, monthOf(today)),
  ]);
  if (!subscription?.plans) return { ok: false, reason: "no_subscription" };
  if (!isSubscriptionUsable(subscription)) {
    return { ok: false, reason: "subscription_inactive" };
  }

  const entries = checkWhatsappEntries(
    subscription.plans,
    usage.whatsapp_entries,
  );
  if (!entries.ok) return entries;
  return checkAiCalls(subscription.plans, usage.ai_calls);
}

/**
 * Pode fazer uma pergunta pelo WhatsApp ("quanto gastei com cimento?")?
 * Pergunta não é lançamento: exige o WhatsApp no plano e chamadas de IA
 * sobrando no mês, mas não conta nem esbarra no limite de lançamentos.
 */
export async function canAskWhatsappQuestion(
  supabase: Client,
  orgId: string,
  today: string,
): Promise<LimitResult> {
  const [subscription, usage] = await Promise.all([
    getOrgPlan(supabase, orgId),
    getUsage(supabase, orgId, monthOf(today)),
  ]);
  if (!subscription?.plans) return { ok: false, reason: "no_subscription" };
  if (!isSubscriptionUsable(subscription)) {
    return { ok: false, reason: "subscription_inactive" };
  }
  if (!subscription.plans.whatsapp_enabled) {
    return { ok: false, reason: "whatsapp_disabled" };
  }
  return checkAiCalls(subscription.plans, usage.ai_calls);
}
