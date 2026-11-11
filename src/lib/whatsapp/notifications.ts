import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { stageStatus } from "@/features/stages/budget";
import { canSendTemplates } from "@/lib/billing/limits";
import { recordUsage } from "@/lib/billing/usage";
import { addDays, todayIn } from "@/lib/dates";
import type { Database } from "@/types/database";

import {
  alertDecision,
  budgetAlertParams,
  hasWeeklyNews,
  isMonday,
  type NotifiedLevel,
  previousWeek,
  weeklyReportParams,
} from "./notification-rules";
import { sendAndLog } from "./send";
import { TEMPLATES, templateMessage } from "./templates";

type Admin = SupabaseClient<Database>;

/**
 * Avisos que o bot manda por conta própria, pelo cron diário: alerta de
 * orçamento (etapa passou de 80% ou de 100% do previsto) e, às segundas, o
 * resumo da semana anterior. Saem por modelos aprovados (templates.ts), só
 * para dono e admin da conta com o WhatsApp ligado e o aviso ligado no
 * perfil, e contam no plano (canSendTemplates).
 *
 * Roda com service_role e sem sessão: toda consulta filtra por org_id.
 */

type Recipient = {
  userId: string;
  phone: string;
  budgetAlerts: boolean;
  weeklyReport: boolean;
};

type OrgTarget = {
  orgId: string;
  timezone: string;
  recipients: Recipient[];
};

export type NotificationSummary = {
  alertsSent: number;
  reportsSent: number;
  failed: number;
  /** Contas que não receberam por causa do limite do plano. */
  limited: number;
};

export async function runNotifications(
  admin: Admin,
  now: Date = new Date(),
  /** Só estas contas (testes, para não mexer nas outras do banco). */
  options: { orgIds?: string[] } = {},
): Promise<NotificationSummary> {
  const summary: NotificationSummary = {
    alertsSent: 0,
    reportsSent: 0,
    failed: 0,
    limited: 0,
  };
  for (const org of await loadTargets(admin, options.orgIds)) {
    // Uma conta com problema não impede as outras.
    try {
      const today = todayIn(org.timezone, now);
      await budgetAlerts(admin, org, today, summary);
      if (isMonday(today)) await weeklyReports(admin, org, today, summary);
    } catch (error) {
      console.error("[avisos] falha na conta", org.orgId, error);
      summary.failed++;
    }
  }
  return summary;
}

/** Contas com ao menos um dono ou admin com o WhatsApp ligado. */
async function loadTargets(
  admin: Admin,
  orgIds?: string[],
): Promise<OrgTarget[]> {
  let query = admin
    .from("organization_members")
    .select(
      "org_id, user_id, organizations(timezone), profiles!inner(whatsapp_phone, whatsapp_budget_alerts, whatsapp_weekly_report)",
    )
    .in("role", ["owner", "admin"])
    .not("profiles.whatsapp_phone", "is", null);
  if (orgIds) query = query.in("org_id", orgIds);
  const { data, error } = await query;
  if (error) throw error;

  const orgs = new Map<string, OrgTarget>();
  for (const row of data) {
    const phone = row.profiles?.whatsapp_phone;
    if (!phone || !row.organizations) continue;
    const org = orgs.get(row.org_id) ?? {
      orgId: row.org_id,
      timezone: row.organizations.timezone,
      recipients: [],
    };
    org.recipients.push({
      userId: row.user_id,
      phone,
      budgetAlerts: row.profiles.whatsapp_budget_alerts,
      weeklyReport: row.profiles.whatsapp_weekly_report,
    });
    orgs.set(row.org_id, org);
  }
  return [...orgs.values()];
}

/** Obras ativas (não arquivadas) da conta, por id. */
async function activeProjects(
  admin: Admin,
  orgId: string,
): Promise<Map<string, string>> {
  const { data, error } = await admin
    .from("projects")
    .select("id, name")
    .eq("org_id", orgId)
    .is("archived_at", null);
  if (error) throw error;
  return new Map(data.map((p) => [p.id, p.name]));
}

/**
 * Manda as mensagens se o plano permite todas; conta as que saíram. Devolve
 * quantas saíram (ou null se o plano não permitiu).
 */
async function sendBatch(
  admin: Admin,
  org: OrgTarget,
  today: string,
  messages: {
    recipient: Recipient;
    message: ReturnType<typeof templateMessage>;
  }[],
  summary: NotificationSummary,
): Promise<boolean[] | null> {
  if (!messages.length) return [];
  const allowed = await canSendTemplates(
    admin,
    org.orgId,
    today,
    messages.length,
  );
  if (!allowed.ok) {
    console.info("[avisos] limite do plano", org.orgId, allowed.reason);
    summary.limited++;
    return null;
  }
  const results = await Promise.all(
    messages.map(({ recipient, message }) =>
      sendAndLog(
        admin,
        recipient.phone,
        { userId: recipient.userId, orgId: org.orgId },
        message,
      ).then(
        () => true,
        (error: unknown) => {
          console.error("[avisos] falha ao mandar", org.orgId, error);
          summary.failed++;
          return false;
        },
      ),
    ),
  );
  const sent = results.filter(Boolean).length;
  if (sent) {
    await recordUsage(admin, org.orgId, today, { templateMessages: sent });
  }
  return results;
}

// Alerta de orçamento ----------------------------------------------------------------

async function budgetAlerts(
  admin: Admin,
  org: OrgTarget,
  today: string,
  summary: NotificationSummary,
): Promise<void> {
  const recipients = org.recipients.filter((r) => r.budgetAlerts);
  const [projects, stages, notified] = await Promise.all([
    activeProjects(admin, org.orgId),
    admin
      .from("v_stage_summary")
      .select(
        "stage_id, project_id, name, budget_cents, spent_cents, committed_cents, progress_percent",
      )
      .eq("org_id", org.orgId),
    admin
      .from("budget_alerts")
      .select("stage_id, level")
      .eq("org_id", org.orgId),
  ]);
  if (stages.error) throw stages.error;
  if (notified.error) throw notified.error;
  const previous = new Map(
    notified.data.map((row) => [row.stage_id, row.level as NotifiedLevel]),
  );

  const toForget: string[] = [];
  const toAlert: {
    stageId: string;
    projectId: string;
    level: NotifiedLevel;
    params: string[];
  }[] = [];
  const toStore: {
    stageId: string;
    projectId: string;
    level: NotifiedLevel;
  }[] = [];

  for (const row of stages.data) {
    if (!row.stage_id || !row.project_id) continue;
    const projectName = projects.get(row.project_id);
    if (!projectName) continue; // obra arquivada
    const plan = {
      budgetCents: row.budget_cents,
      spentCents: row.spent_cents ?? 0,
      committedCents: row.committed_cents ?? 0,
      progressPercent: row.progress_percent ?? 0,
    };
    const status = stageStatus(plan);
    const before = previous.get(row.stage_id) ?? null;
    const decision = alertDecision(status.level, before);
    if (decision.store === null) {
      if (before) toForget.push(row.stage_id);
      continue;
    }
    const item = {
      stageId: row.stage_id,
      projectId: row.project_id,
      level: decision.store,
    };
    if (decision.notify) {
      toAlert.push({
        ...item,
        params: budgetAlertParams({
          projectName,
          stageName: row.name ?? "",
          status,
          usedCents: plan.spentCents + plan.committedCents,
          budgetCents: plan.budgetCents ?? 0,
        }),
      });
    } else if (decision.store !== before) {
      // Voltou de 100% para 80%: guarda sem avisar.
      toStore.push(item);
    }
  }

  if (toForget.length) {
    const { error } = await admin
      .from("budget_alerts")
      .delete()
      .eq("org_id", org.orgId)
      .in("stage_id", toForget);
    if (error) throw error;
  }

  // Sem ninguém para avisar, o alerta fica para quando alguém ligar o aviso.
  if (recipients.length && toAlert.length) {
    const messages = toAlert.flatMap((alert) =>
      recipients.map((recipient) => ({
        recipient,
        message: templateMessage("budgetAlert", alert.params),
      })),
    );
    const results = await sendBatch(admin, org, today, messages, summary);
    if (results) {
      // Etapa avisada para ao menos uma pessoa: não avisa de novo.
      toAlert.forEach((alert, index) => {
        const slice = results.slice(
          index * recipients.length,
          (index + 1) * recipients.length,
        );
        if (slice.some(Boolean)) toStore.push(alert);
      });
      summary.alertsSent += results.filter(Boolean).length;
    }
  }

  if (toStore.length) {
    const { error } = await admin.from("budget_alerts").upsert(
      toStore.map((item) => ({
        stage_id: item.stageId,
        org_id: org.orgId,
        project_id: item.projectId,
        level: item.level,
        notified_at: new Date().toISOString(),
      })),
      { onConflict: "stage_id" },
    );
    if (error) throw error;
  }
}

// Resumo semanal ----------------------------------------------------------------------

/** Já saiu resumo para esta conta nas últimas 20 h (cron repetido)? */
async function reportAlreadySent(admin: Admin, orgId: string) {
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("direction", "out")
    .eq("type", "template")
    .eq("payload->>name", TEMPLATES.weeklyReport.name)
    .gte("created_at", since);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function weeklyReports(
  admin: Admin,
  org: OrgTarget,
  today: string,
  summary: NotificationSummary,
): Promise<void> {
  const recipients = org.recipients.filter((r) => r.weeklyReport);
  if (!recipients.length || (await reportAlreadySent(admin, org.orgId))) {
    return;
  }
  const projects = await activeProjects(admin, org.orgId);
  if (!projects.size) return;

  const week = previousWeek(today);
  const [expenses, totals, payables] = await Promise.all([
    admin
      .from("expenses")
      .select("project_id, amount_cents, categories(code)")
      .eq("org_id", org.orgId)
      .eq("status", "confirmed")
      .is("deleted_at", null)
      .gte("spent_on", week.from)
      .lte("spent_on", week.to)
      .limit(10_000),
    admin
      .from("v_project_summary")
      .select("project_id, construction_cents")
      .eq("org_id", org.orgId),
    admin
      .from("payables")
      .select("project_id, amount_cents, due_date")
      .eq("org_id", org.orgId)
      .eq("status", "open")
      .lte("due_date", addDays(today, 6))
      .limit(10_000),
  ]);
  if (expenses.error) throw expenses.error;
  if (totals.error) throw totals.error;
  if (payables.error) throw payables.error;

  const messages = [...projects].flatMap(([projectId, projectName]) => {
    // Construção: sem terreno (CLAUDE.md, seção 5).
    const weekRows = expenses.data.filter(
      (e) => e.project_id === projectId && e.categories?.code !== "terreno",
    );
    const bills = payables.data.filter((p) => p.project_id === projectId);
    const numbers = {
      projectName,
      weekSpentCents: weekRows.reduce((t, e) => t + e.amount_cents, 0),
      weekCount: weekRows.length,
      constructionCents:
        totals.data.find((t) => t.project_id === projectId)
          ?.construction_cents ?? 0,
      upcomingCents: bills
        .filter((p) => p.due_date >= today)
        .reduce((t, p) => t + p.amount_cents, 0),
      overdueCents: bills
        .filter((p) => p.due_date < today)
        .reduce((t, p) => t + p.amount_cents, 0),
    };
    if (!hasWeeklyNews(numbers)) return [];
    const message = templateMessage(
      "weeklyReport",
      weeklyReportParams(numbers),
    );
    return recipients.map((recipient) => ({ recipient, message }));
  });

  const results = await sendBatch(admin, org, today, messages, summary);
  if (results) summary.reportsSent += results.filter(Boolean).length;
}
