import "server-only";

import { todayIn } from "@/lib/dates";

import type { BotCommand } from "../commands";
import { saveConversation } from "../conversation";
import {
  botMessages,
  formatProjectSummary,
  formatSummary,
  projectListMessage,
} from "../messages";
import { type LaunchableProject, listLaunchableProjects } from "../projects";
import type { BotSession } from "./expense";

/** Janela do "desfazer" (CLAUDE.md, seção 6). */
const UNDO_WINDOW_MS = 10 * 60 * 1000;

/**
 * Comandos de texto: ajuda, obras, resumo e desfazer. Não chamam a IA nem
 * contam no plano. Como o resto do bot, rodam com service_role e filtram
 * por pessoa e conta à mão.
 */
export async function handleCommand(
  session: BotSession,
  command: BotCommand,
): Promise<void> {
  switch (command) {
    case "help":
      return session.send({ type: "text", body: botMessages.help });
    case "projects":
      return listProjects(session);
    case "summary":
      return summary(session);
    case "undo":
      return undo(session);
  }
}

/** "obras": lista para trocar a obra ativa (ou avisa qual é a única). */
async function listProjects(session: BotSession): Promise<void> {
  const { admin, userId, conversation } = session;
  const projects = await listLaunchableProjects(admin, userId);
  if (!projects.length) {
    return session.send({ type: "text", body: botMessages.noProjects });
  }
  if (projects.length === 1) {
    const [only] = projects as [LaunchableProject];
    await Promise.all([
      only.id === conversation.active_project_id
        ? Promise.resolve()
        : saveConversation(admin, userId, {
            activeOrgId: only.orgId,
            activeProjectId: only.id,
          }),
      session.send({ type: "text", body: botMessages.onlyProject(only.name) }),
    ]);
    return;
  }
  return session.send(
    projectListMessage(projects, hasManyOrgs(projects), {
      body: botMessages.projectsQuestion,
      activeId: conversation.active_project_id,
    }),
  );
}

/** "resumo": da obra ativa; sem obra ativa e com várias, pergunta qual. */
async function summary(session: BotSession): Promise<void> {
  const { admin, userId, conversation } = session;
  const projects = await listLaunchableProjects(admin, userId);
  if (!projects.length) {
    return session.send({ type: "text", body: botMessages.noProjects });
  }
  const project =
    projects.find((p) => p.id === conversation.active_project_id) ??
    (projects.length === 1 ? projects[0] : undefined);
  if (!project) {
    await Promise.all([
      saveConversation(admin, userId, {
        state: "awaiting_project",
        context: { pendingCommand: "summary" },
      }),
      session.send(
        projectListMessage(projects, hasManyOrgs(projects), {
          body: botMessages.summaryWhichProject,
        }),
      ),
    ]);
    return;
  }
  return sendProjectSummary(session, project);
}

/** Monta e manda o resumo da obra (também chamado depois de escolher a obra). */
export async function sendProjectSummary(
  session: BotSession,
  project: LaunchableProject,
): Promise<void> {
  const { admin } = session;
  // Os dois resumos ao mesmo tempo, sempre filtrados pela conta e pela obra.
  const [projectRow, stageRows] = await Promise.all([
    admin
      .from("v_project_summary")
      .select("construction_cents, land_cents, unclassified_count")
      .eq("org_id", project.orgId)
      .eq("project_id", project.id)
      .maybeSingle(),
    admin
      .from("v_stage_summary")
      .select("name, budget_cents, spent_cents, committed_cents")
      .eq("org_id", project.orgId)
      .eq("project_id", project.id),
  ]);
  if (projectRow.error) throw projectRow.error;
  if (stageRows.error) throw stageRows.error;

  const stages = stageRows.data;
  const body = formatProjectSummary({
    projectName: project.name,
    constructionCents: projectRow.data?.construction_cents ?? 0,
    landCents: projectRow.data?.land_cents ?? 0,
    unclassifiedCount: projectRow.data?.unclassified_count ?? 0,
    budgetCents: stages.reduce((sum, s) => sum + (s.budget_cents ?? 0), 0),
    committedCents: stages.reduce(
      (sum, s) => sum + (s.committed_cents ?? 0),
      0,
    ),
    stages: stages.map((s) => ({
      name: s.name ?? "",
      spentCents: s.spent_cents ?? 0,
      budgetCents: s.budget_cents,
    })),
  });
  return session.send({ type: "text", body });
}

/**
 * "desfazer": cancela o último lançamento confirmado pela própria pessoa
 * pelo WhatsApp nos últimos 10 minutos, numa obra em que ela ainda lança.
 * A hora da confirmação é o updated_at (confirmar é a última mudança que o
 * bot faz no gasto).
 */
async function undo(session: BotSession): Promise<void> {
  const { admin, userId } = session;
  const since = new Date(Date.now() - UNDO_WINDOW_MS).toISOString();
  const [projects, latest] = await Promise.all([
    listLaunchableProjects(admin, userId),
    admin
      .from("expenses")
      .select(
        "id, org_id, project_id, amount_cents, description, spent_on, payment_method, has_invoice, categories(code), suppliers(name), stages(name)",
      )
      .eq("created_by", userId)
      .eq("status", "confirmed")
      .is("deleted_at", null)
      .in("source", ["whatsapp_text", "whatsapp_audio", "whatsapp_image"])
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (latest.error) throw latest.error;
  const expense = latest.data;
  const project = expense
    ? projects.find(
        (p) => p.id === expense.project_id && p.orgId === expense.org_id,
      )
    : undefined;
  if (!expense || !project) {
    return session.send({ type: "text", body: botMessages.nothingToUndo });
  }

  const { data: cancelled, error } = await admin
    .from("expenses")
    .update({ status: "cancelled" })
    .eq("id", expense.id)
    .eq("org_id", expense.org_id)
    .eq("created_by", userId)
    .eq("status", "confirmed")
    .select("id");
  if (error) throw error;
  if (!cancelled.length) {
    return session.send({ type: "text", body: botMessages.nothingToUndo });
  }

  const summary = formatSummary(
    {
      amountCents: expense.amount_cents,
      categoryCode: expense.categories?.code ?? "outros",
      stageName: expense.stages?.name ?? null,
      description: expense.description,
      supplierName: expense.suppliers?.name ?? null,
      spentOn: expense.spent_on,
      paymentMethod: expense.payment_method,
      hasInvoice: expense.has_invoice,
      projectName: project.name,
    },
    todayIn(project.timezone),
  );
  return session.send({ type: "text", body: botMessages.undone(summary) });
}

function hasManyOrgs(projects: LaunchableProject[]): boolean {
  return new Set(projects.map((p) => p.orgId)).size > 1;
}
