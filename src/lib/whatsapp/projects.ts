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

/**
 * Obras (não arquivadas) em que a pessoa pode lançar gastos, em todas as
 * contas de que participa: dono e admin lançam em todas as obras da conta;
 * membro só nas obras em que é "editor". Quem só acompanha (viewer) não lança.
 * Mesma regra do RLS, aplicada à mão porque o webhook roda sem sessão.
 */
export async function listLaunchableProjects(
  admin: Admin,
  userId: string,
): Promise<LaunchableProject[]> {
  // Duas consultas em paralelo: as contas (com as obras de cada uma) e as
  // obras em que a pessoa é "editor".
  const [memberships, editorOf] = await Promise.all([
    admin
      .from("organization_members")
      .select(
        "org_id, role, organizations(name, timezone, projects(id, name, archived_at, created_at))",
      )
      .eq("user_id", userId),
    admin
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId)
      .eq("role", "editor"),
  ]);
  if (memberships.error) throw memberships.error;
  if (editorOf.error) throw editorOf.error;

  const editable = new Set(editorOf.data.map((row) => row.project_id));
  return memberships.data
    .flatMap((membership) => {
      const org = membership.organizations;
      if (!org) return [];
      const manager =
        membership.role === "owner" || membership.role === "admin";
      return org.projects
        .filter((p) => !p.archived_at && (manager || editable.has(p.id)))
        .map((p) => ({
          id: p.id,
          name: p.name,
          orgId: membership.org_id,
          orgName: org.name,
          timezone: org.timezone,
          createdAt: p.created_at,
        }));
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
