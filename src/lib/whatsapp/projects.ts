import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

export type LaunchableProject = {
  id: string;
  name: string;
  orgId: string;
  orgName: string;
  timezone: string;
  createdAt: string;
};

/** Obra que a pessoa vê, dizendo se ela também pode lançar gastos nela. */
export type BotProject = LaunchableProject & { canLaunch: boolean };

/**
 * Obras (não arquivadas) que a pessoa vê, em todas as contas de que
 * participa: dono e admin veem e lançam em todas as obras da conta; membro só
 * nas obras em que está em project_members, lançando só como "editor" (quem
 * só acompanha, "viewer", só vê). Mesma regra do RLS, aplicada à mão porque o
 * webhook roda sem sessão.
 */
export async function listVisibleProjects(
  admin: Admin,
  userId: string,
): Promise<BotProject[]> {
  // Duas consultas em paralelo: as contas (com as obras de cada uma) e as
  // obras em que a pessoa foi convidada.
  const [memberships, memberOf] = await Promise.all([
    admin
      .from("organization_members")
      .select(
        "org_id, role, organizations(name, timezone, projects(id, name, archived_at, created_at))",
      )
      .eq("user_id", userId),
    admin
      .from("project_members")
      .select("project_id, role")
      .eq("user_id", userId),
  ]);
  if (memberships.error) throw memberships.error;
  if (memberOf.error) throw memberOf.error;

  const roles = new Map(memberOf.data.map((row) => [row.project_id, row.role]));
  return memberships.data
    .flatMap((membership) => {
      const org = membership.organizations;
      if (!org) return [];
      const manager =
        membership.role === "owner" || membership.role === "admin";
      return org.projects
        .filter((p) => !p.archived_at && (manager || roles.has(p.id)))
        .map((p) => ({
          id: p.id,
          name: p.name,
          orgId: membership.org_id,
          orgName: org.name,
          timezone: org.timezone,
          createdAt: p.created_at,
          canLaunch: manager || roles.get(p.id) === "editor",
        }));
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Obras em que a pessoa pode lançar gastos. */
export async function listLaunchableProjects(
  admin: Admin,
  userId: string,
): Promise<BotProject[]> {
  const projects = await listVisibleProjects(admin, userId);
  return projects.filter((p) => p.canLaunch);
}

/**
 * Obras com que o bot trabalha: as que a pessoa lança. Quem só acompanha
 * (viewer em todas as obras) usa o bot para perguntas: recebe as obras que vê,
 * todas com canLaunch = false. Quem lança em alguma obra não pergunta pelo
 * bot sobre as obras em que só acompanha (uma lista só, sem misturar).
 */
export async function listBotProjects(
  admin: Admin,
  userId: string,
): Promise<BotProject[]> {
  const projects = await listVisibleProjects(admin, userId);
  const launchable = projects.filter((p) => p.canLaunch);
  return launchable.length ? launchable : projects;
}
