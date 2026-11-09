import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

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
  const { data: projects } = await query;
  if (!projects?.length) return [];

  const { data: summaries } = await supabase
    .from("v_project_summary")
    .select("project_id, construction_cents, land_cents, expense_count")
    .in(
      "project_id",
      projects.map((p) => p.id),
    );
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select(
      "id, org_id, name, address, city, state, built_area_m2, standard, start_date, status, archived_at",
    )
    .eq("org_id", orgId)
    .eq("id", projectId)
    .maybeSingle();
  return data;
});

/**
 * O que a pessoa logada pode fazer na obra. Dono e admin editam todas; os
 * demais, conforme o papel em project_members. Só para decidir o que mostrar:
 * quem barra de verdade é o RLS.
 */
export const getProjectAccess = cache(
  async (orgId: string, projectId: string) => {
    const userId = await requireUserId();
    const supabase = await createClient();
    const [{ data: membership }, { data: projectMember }] = await Promise.all([
      supabase
        .from("organization_members")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    const isOrgAdmin =
      membership?.role === "owner" || membership?.role === "admin";
    return {
      userId,
      isOrgAdmin,
      canEdit: isOrgAdmin || projectMember?.role === "editor",
    };
  },
);

/**
 * Use no começo de TODA página de /o/[orgSlug]/obras/[projectId]/...
 * Obra inexistente ou sem acesso vira 404.
 */
export async function requireProject(orgSlug: string, projectId: string) {
  const org = await requireOrg(orgSlug);
  if (!isUuid(projectId)) notFound();
  const project = await getProject(org.id, projectId);
  if (!project) notFound();
  const access = await getProjectAccess(org.id, projectId);
  return { org, project, access };
}

/** Pode criar obras nesta organização (dono ou admin)? */
export async function canManageOrg(orgId: string): Promise<boolean> {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role === "owner" || data?.role === "admin";
}
