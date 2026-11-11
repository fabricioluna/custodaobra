import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { BILLING_LIVE, PAST_DUE_GRACE_DAYS } from "./plans";

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
  | "max_ai_calls"
  | "max_template_messages";

type Plan = Database["public"]["Tables"]["plans"]["Row"];
type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

type SubscriptionDates = {
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

/**
 * Em que pé está a assinatura:
 * - `trial`: em teste; `trial_over`: o teste acabou sem plano pago;
 * - `active`: em dia; `past_due`: mensalidade atrasada, ainda na tolerância;
 *   `past_due_over`: atrasada além da tolerância;
 * - `cancelled`: cancelada (vale até o fim do que já foi pago).
 */
export type SubscriptionPhase =
  | "trial"
  | "trial_over"
  | "active"
  | "past_due"
  | "past_due_over"
  | "cancelled";

export type SubscriptionState = {
  phase: SubscriptionPhase;
  /** Pode criar coisas novas (gastos, obras, contas, convites)? */
  usable: boolean;
  /** Dias inteiros até o fim do teste ou do período pago (nulo se não há). */
  daysLeft: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY_MS);
}

/**
 * Regra pura da situação da assinatura. Com a cobrança desligada
 * (`billingLive = false`), teste vencido e atraso não bloqueiam: os planos
 * ainda são provisórios e não haveria onde pagar.
 */
export function subscriptionState(
  subscription: SubscriptionDates,
  now: Date = new Date(),
  billingLive: boolean = BILLING_LIVE,
): SubscriptionState {
  const trialLeft = daysUntil(subscription.trial_ends_at, now);
  const periodLeft = daysUntil(subscription.current_period_end, now);
  const state = (
    phase: SubscriptionPhase,
    usable: boolean,
    daysLeft: number | null,
  ): SubscriptionState => ({
    phase,
    // Sem cobrança no ar, só a cancelada bloqueia (como antes da Fase 5).
    usable: usable || (!billingLive && phase !== "cancelled"),
    daysLeft,
  });

  switch (subscription.status) {
    case "active":
      return state("active", true, periodLeft);
    case "trialing":
      return trialLeft !== null && trialLeft <= 0
        ? state("trial_over", false, 0)
        : state("trial", true, trialLeft);
    case "past_due": {
      // Tolerância contada do vencimento (fim do período pago).
      const overdueDays = periodLeft === null ? 0 : -periodLeft;
      return overdueDays > PAST_DUE_GRACE_DAYS
        ? state("past_due_over", false, periodLeft)
        : state("past_due", true, periodLeft);
    }
    case "cancelled": {
      // Vale até o fim do período pago ou do teste, o que vier depois.
      const left = Math.max(periodLeft ?? 0, trialLeft ?? 0);
      return state("cancelled", left > 0, left > 0 ? left : 0);
    }
  }
}

/** Regra pura: a assinatura permite criar coisas novas agora? */
export function isSubscriptionUsable(
  subscription: SubscriptionDates,
  now: Date = new Date(),
  billingLive: boolean = BILLING_LIVE,
): boolean {
  return subscriptionState(subscription, now, billingLive).usable;
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

/**
 * Regra pura: dá para mandar mais `count` mensagens por modelo (avisos que o
 * bot manda sem a pessoa ter escrito, cobradas pela Meta) este mês?
 */
export function checkTemplateMessages(
  plan: Pick<Plan, "whatsapp_enabled" | "max_template_messages_month">,
  usedThisMonth: number,
  count = 1,
): LimitResult {
  if (!plan.whatsapp_enabled) return { ok: false, reason: "whatsapp_disabled" };
  if (usedThisMonth + count > plan.max_template_messages_month) {
    return {
      ok: false,
      reason: "max_template_messages",
      limit: plan.max_template_messages_month,
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
    .select("status, trial_ends_at, current_period_end, plans(*)")
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
    .select("whatsapp_entries, ai_calls, template_messages")
    .eq("org_id", orgId)
    .eq("month", month)
    .maybeSingle();
  if (error) throw new Error("Não foi possível ler o uso do plano.");
  return data ?? { whatsapp_entries: 0, ai_calls: 0, template_messages: 0 };
}

/**
 * O que o plano ainda permite pelo WhatsApp neste mês, numa leitura só:
 * - `ai`: chamar a IA (WhatsApp no plano e chamadas de IA sobrando). Vale
 *   para ler qualquer mensagem, inclusive perguntas.
 * - `entries`: lançar mais um gasto (limite de lançamentos pelo WhatsApp).
 * Usado pelo webhook (cliente service_role, sem sessão). `today` é a data no
 * fuso da organização: o mês do plano vira no fuso dela.
 */
export async function whatsappAllowance(
  supabase: Client,
  orgId: string,
  today: string,
): Promise<{ ai: LimitResult; entries: LimitResult }> {
  const [subscription, usage] = await Promise.all([
    getOrgPlan(supabase, orgId),
    getUsage(supabase, orgId, monthOf(today)),
  ]);
  const blocked = (result: LimitResult) => ({ ai: result, entries: result });
  if (!subscription?.plans) {
    return blocked({ ok: false, reason: "no_subscription" });
  }
  if (!isSubscriptionUsable(subscription)) {
    return blocked({ ok: false, reason: "subscription_inactive" });
  }
  if (!subscription.plans.whatsapp_enabled) {
    return blocked({ ok: false, reason: "whatsapp_disabled" });
  }
  return {
    ai: checkAiCalls(subscription.plans, usage.ai_calls),
    entries: checkWhatsappEntries(subscription.plans, usage.whatsapp_entries),
  };
}

/**
 * Pode lançar mais um gasto pelo WhatsApp e chamar a IA para lê-lo? (Foto
 * de comprovante: é sempre um gasto.)
 */
export async function canUseWhatsappAi(
  supabase: Client,
  orgId: string,
  today: string,
): Promise<LimitResult> {
  const { ai, entries } = await whatsappAllowance(supabase, orgId, today);
  return entries.ok ? ai : entries;
}

/**
 * Pode chamar a IA para ler uma mensagem que ainda não se sabe se é gasto
 * (texto, áudio) ou que é pergunta ("quanto gastei com cimento?")? Pergunta
 * não é lançamento: não conta nem esbarra no limite de lançamentos, que é
 * conferido depois, quando a mensagem é mesmo um gasto.
 */
export async function canAskWhatsappQuestion(
  supabase: Client,
  orgId: string,
  today: string,
): Promise<LimitResult> {
  return (await whatsappAllowance(supabase, orgId, today)).ai;
}

/**
 * Pode mandar mais `count` avisos por modelo (alerta de orçamento, resumo
 * semanal) para pessoas desta conta? Usado pelo cron (service_role).
 */
export async function canSendTemplates(
  supabase: Client,
  orgId: string,
  today: string,
  count = 1,
): Promise<LimitResult> {
  const [subscription, usage] = await Promise.all([
    getOrgPlan(supabase, orgId),
    getUsage(supabase, orgId, monthOf(today)),
  ]);
  if (!subscription?.plans) return { ok: false, reason: "no_subscription" };
  if (!isSubscriptionUsable(subscription)) {
    return { ok: false, reason: "subscription_inactive" };
  }
  return checkTemplateMessages(
    subscription.plans,
    usage.template_messages,
    count,
  );
}

/**
 * Pode criar dados novos nesta conta pelo app (gasto, conta a pagar, pagar
 * uma conta)? Bloqueio suave: com o teste vencido ou a mensalidade atrasada
 * além da tolerância, a pessoa continua vendo, editando e exportando tudo,
 * só não cria nada novo.
 */
export async function canWrite(
  supabase: Client,
  orgId: string,
): Promise<LimitResult> {
  const subscription = await getOrgPlan(supabase, orgId);
  if (!subscription?.plans) return { ok: false, reason: "no_subscription" };
  if (!isSubscriptionUsable(subscription)) {
    return { ok: false, reason: "subscription_inactive" };
  }
  return { ok: true };
}

export type UsageMeter = { used: number; limit: number };

export type PlanOverview = {
  plan: Pick<Plan, "code" | "name" | "price_cents_month" | "whatsapp_enabled">;
  state: SubscriptionState;
  trialEndsAt: string | null;
  periodEndsAt: string | null;
  usage: {
    projects: UsageMeter;
    members: UsageMeter;
    whatsappEntries: UsageMeter;
    aiCalls: UsageMeter;
    templateMessages: UsageMeter;
  };
};

/**
 * Plano, situação e uso do mês, para a tela "Plano e uso" (dono e admin: o
 * RLS de usage_counters só mostra a eles). `today` no fuso da conta.
 */
export async function getPlanOverview(
  supabase: Client,
  orgId: string,
  today: string,
): Promise<PlanOverview | null> {
  const [subscription, usage, projects, members, invitations] =
    await Promise.all([
      getOrgPlan(supabase, orgId),
      getUsage(supabase, orgId, monthOf(today)),
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .is("archived_at", null),
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
  if (!subscription?.plans) return null;
  const plan = subscription.plans;
  return {
    plan: {
      code: plan.code,
      name: plan.name,
      price_cents_month: plan.price_cents_month,
      whatsapp_enabled: plan.whatsapp_enabled,
    },
    state: subscriptionState(subscription),
    trialEndsAt: subscription.trial_ends_at,
    periodEndsAt: subscription.current_period_end,
    usage: {
      projects: { used: projects.count ?? 0, limit: plan.max_projects },
      members: {
        used: (members.count ?? 0) + (invitations.count ?? 0),
        limit: plan.max_members,
      },
      whatsappEntries: {
        used: usage.whatsapp_entries,
        limit: plan.max_whatsapp_entries_month,
      },
      aiCalls: { used: usage.ai_calls, limit: plan.max_ai_calls_month },
      templateMessages: {
        used: usage.template_messages,
        limit: plan.max_template_messages_month,
      },
    },
  };
}

/** Situação da assinatura da conta (para o aviso no topo do app). */
export async function getSubscriptionState(
  supabase: Client,
  orgId: string,
): Promise<SubscriptionState | null> {
  const subscription = await getOrgPlan(supabase, orgId);
  return subscription ? subscriptionState(subscription) : null;
}
