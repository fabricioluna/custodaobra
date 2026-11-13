import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { getOrgRole, isOrgAdminRole } from "@/features/members/queries";
import { requireOrg } from "@/features/organizations/queries";
import { requireUserId } from "@/lib/auth/session";
import { isUuid } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/**
 * Obras da organização com o resumo de gastos, mais recentes primeiro.
 * Por padrão só as ativas; `archived: "only"` traz só as arquivadas.
 */
export async function listProjects(
  orgId: string,
  { archived = "exclude" }: { archived?: "exclude" | "include" | "only" } = {},
) {
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select(
      "id, name, city, state, status, archived_at, built_area_m2, created_at",
    )
    .eq("org_id", orgId)
    .order("archived_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });
  if (archived === "exclude") query = query.is("archived_at", null);
  if (archived === "only") query = query.not("archived_at", "is", null);
  // Resumos da conta toda junto com as obras (uma rodada só ao banco, em vez
  // de esperar a lista para pedir só os dela). Vêm também os das obras
  // arquivadas, ignorados aqui; se uma conta juntar muitas arquivadas, vale
  // pôr `archived_at` na view para filtrar.
  const [{ data: projects }, { data: summaries }] = await Promise.all([
    query,
    supabase
      .from("v_project_summary")
      .select("project_id, construction_cents, land_cents, expense_count")
      .eq("org_id", orgId),
  ]);
  if (!projects?.length) return [];

  const byId = new Map(summaries?.map((s) => [s.project_id, s]));

  return projects.map((project) => ({
    ...project,
    constructionCents: byId.get(project.id)?.construction_cents ?? 0,
    landCents: byId.get(project.id)?.land_cents ?? 0,
    expenseCount: byId.get(project.id)?.expense_count ?? 0,
  }));
}

/** Quantas obras arquivadas a organização tem (para o link na lista). */
export async function countArchivedProjects(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .not("archived_at", "is", null);
  return count ?? 0;
}

export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number];

export const getProject = cache(async (orgId: string, projectId: string) => {
  const project = await getProjectById(projectId);
  return project?.org_id === orgId ? project : null;
});

/** A obra pelo id (o RLS só devolve se a pessoa pode vê-la). */
const getProjectById = cache(async (projectId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select(
      "id, org_id, name, address, city, state, built_area_m2, standard, start_date, status, archived_at",
    )
    .eq("id", projectId)
    .maybeSingle();
  return data;
});

/** Papel da pessoa logada na obra (project_members), se tiver. */
const getProjectRole = cache(async (projectId: string) => {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ?? null;
});

/**
 * O que a pessoa logada pode fazer na obra. Dono e admin editam todas; os
 * demais, conforme o papel em project_members. Só para decidir o que mostrar:
 * quem barra de verdade é o RLS.
 */
export const getProjectAccess = cache(
  async (orgId: string, projectId: string) => {
    const [userId, orgRole, projectRole] = await Promise.all([
      requireUserId(),
      getOrgRole(orgId),
      getProjectRole(projectId),
    ]);
    const isOrgAdmin = isOrgAdminRole(orgRole);
    return {
      userId,
      isOrgAdmin,
      canEdit: isOrgAdmin || projectRole === "editor",
    };
  },
);

/**
 * Use no começo de TODA página de /o/[orgSlug]/obras/[projectId]/...
 * Obra inexistente ou sem acesso vira 404.
 *
 * Conta (com o papel), obra e papel na obra saem juntos, numa rodada só ao
 * banco: as consultas não dependem umas das outras (a obra vem pelo id e é
 * conferida contra a conta depois).
 */
export async function requireProject(orgSlug: string, projectId: string) {
  // Sessão primeiro (lida do cookie, sem ir ao banco): sem login, sempre o
  // login, nunca um 404 que dependa de qual consulta terminou antes.
  await requireUserId();
  if (!isUuid(projectId)) notFound();
  // O papel na obra entra junto para já estar pronto quando getProjectAccess
  // pedir (para dono e admin ele não muda nada, mas não custa espera: corre
  // em paralelo).
  const [org, project] = await Promise.all([
    requireOrg(orgSlug),
    getProjectById(projectId),
    getProjectRole(projectId),
  ]);
  if (!project || project.org_id !== org.id) notFound();
  const access = await getProjectAccess(org.id, projectId);
  return { org, project, access };
}

/** Pode criar obras nesta organização (dono ou admin)? */
export async function canManageOrg(orgId: string): Promise<boolean> {
  // O papel quase sempre já veio junto com a conta (getOrgContext).
  return isOrgAdminRole(await getOrgRole(orgId));
}
