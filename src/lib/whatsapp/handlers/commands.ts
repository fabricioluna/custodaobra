import "server-only";

import { cleanStageName, findOrCreateStage } from "@/features/stages/create";
import { todayIn } from "@/lib/dates";

import type { BotCommand } from "../commands";
import {
  keepPendingSupplier,
  saveConversation,
  WHATSAPP_SOURCES,
} from "../conversation";
import {
  botMessages,
  formatProjectSummary,
  formatSummary,
  projectListMessage,
} from "../messages";
import {
  type BotProject,
  type LaunchableProject,
  listBotProjects,
  listLaunchableProjects,
} from "../projects";
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
  if (typeof command === "object") return newStage(session, command.name);
  switch (command) {
    case "help":
      return help(session);
    case "projects":
      return listProjects(session);
    case "summary":
      return summary(session);
    case "undo":
      return undo(session);
  }
}

/**
 * "nova etapa Muro": cria a etapa na obra ativa (ou na única em que a pessoa
 * lança). Se já existe com esse nome, só avisa.
 */
async function newStage(session: BotSession, rawName: string): Promise<void> {
  const { admin, userId, conversation } = session;
  if (!rawName) {
    return session.send({
      type: "text",
      body: botMessages.newStageCommandHelp,
    });
  }
  const name = cleanStageName(rawName);
  if (!name) {
    return session.send({ type: "text", body: botMessages.newStageInvalid });
  }
  // Só as obras em que a pessoa lança (dono, admin ou editor): a mesma
  // regra do RLS para criar etapas, aplicada à mão (service_role).
  const projects = await listLaunchableProjects(admin, userId);
  if (!projects.length) {
    const visible = await listBotProjects(admin, userId);
    return session.send({
      type: "text",
      body: visible.length
        ? botMessages.newStageViewer
        : botMessages.noProjects,
    });
  }
  const project =
    projects.find((p) => p.id === conversation.active_project_id) ??
    (projects.length === 1 ? projects[0] : undefined);
  if (!project) {
    return session.send({
      type: "text",
      body: botMessages.newStageChooseProject,
    });
  }
  const stage = await findOrCreateStage(admin, project.orgId, project.id, name);
  if (!stage) {
    return session.send({ type: "text", body: botMessages.newStageFailed });
  }
  return session.send({
    type: "text",
    body: stage.created
      ? botMessages.stageCreated(stage.name, project.name)
      : botMessages.stageExists(stage.name, project.name),
  });
}

/** "ajuda": quem só acompanha recebe a versão das perguntas. */
async function help(session: BotSession): Promise<void> {
  const projects = await listBotProjects(session.admin, session.userId);
  const viewer = projects.length > 0 && !projects[0]?.canLaunch;
  return session.send({
    type: "text",
    body: viewer ? botMessages.viewerHelp : botMessages.help,
  });
}

/**
 * "obras": lista para trocar a obra ativa (ou avisa qual é a única). Quem só
 * acompanha troca a obra das perguntas.
 */
async function listProjects(session: BotSession): Promise<void> {
  const { admin, userId, conversation } = session;
  const projects = await listBotProjects(admin, userId);
  if (!projects.length) {
    return session.send({ type: "text", body: botMessages.noProjects });
  }
  const viewer = !projects[0]?.canLaunch;
  if (projects.length === 1) {
    const [only] = projects as [BotProject];
    await Promise.all([
      only.id === conversation.active_project_id
        ? Promise.resolve()
        : saveConversation(admin, userId, {
            activeOrgId: only.orgId,
            activeProjectId: only.id,
          }),
      session.send({
        type: "text",
        body: viewer
          ? botMessages.viewerOnlyProject(only.name)
          : botMessages.onlyProject(only.name),
      }),
    ]);
    return;
  }
  return session.send(
    projectListMessage(projects, hasManyOrgs(projects), {
      body: viewer
        ? botMessages.viewerProjectsQuestion
        : botMessages.projectsQuestion,
      activeId: conversation.active_project_id,
    }),
  );
}

/** "resumo": da obra ativa; sem obra ativa e com várias, pergunta qual. */
async function summary(session: BotSession): Promise<void> {
  const { admin, userId, conversation } = session;
  const projects = await listBotProjects(admin, userId);
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
        context: {
          ...keepPendingSupplier(conversation.context),
          pendingCommand: "summary",
        },
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
 * pelo WhatsApp nos últimos 10 minutos (pela hora da confirmação, que o
 * banco grava em confirmed_at), numa obra em que ela ainda lança.
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
      .in("source", WHATSAPP_SOURCES)
      .gte("confirmed_at", since)
      .order("confirmed_at", { ascending: false })
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

/**
 * "Mais obras": a mesma lista na página pedida, com a pergunta que estava
 * valendo (resumo, gasto à espera da obra ou troca de obra).
 */
export async function sendProjectPage(
  session: BotSession,
  page: number,
): Promise<void> {
  const { admin, userId, conversation } = session;
  const projects = await listBotProjects(admin, userId);
  if (!projects.length) {
    return session.send({ type: "text", body: botMessages.noProjects });
  }
  const viewer = !projects[0]?.canLaunch;
  const { pendingCommand, pendingText, pendingMedia } = conversation.context;
  const body =
    pendingCommand === "summary"
      ? botMessages.summaryWhichProject
      : pendingText || pendingMedia
        ? viewer
          ? botMessages.questionWhichProject
          : botMessages.chooseProject
        : viewer
          ? botMessages.viewerProjectsQuestion
          : botMessages.projectsQuestion;
  return session.send(
    projectListMessage(projects, hasManyOrgs(projects), {
      body,
      activeId: conversation.active_project_id,
      page,
    }),
  );
}

function hasManyOrgs(projects: LaunchableProject[]): boolean {
  return new Set(projects.map((p) => p.orgId)).size > 1;
}
