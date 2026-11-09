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
  const [memberships, editorOf] = await Promise.all([
    admin
      .from("organization_members")
      .select("org_id, role, organizations(name, timezone)")
      .eq("user_id", userId),
    admin
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId)
      .eq("role", "editor"),
  ]);
  if (memberships.error) throw memberships.error;
  if (editorOf.error) throw editorOf.error;

  const orgs = new Map(
    memberships.data.map((m) => [
      m.org_id,
      {
        manager: m.role === "owner" || m.role === "admin",
        name: m.organizations?.name ?? "",
        timezone: m.organizations?.timezone ?? "America/Recife",
      },
    ]),
  );
  if (!orgs.size) return [];

  const { data: projects, error } = await admin
    .from("projects")
    .select("id, name, org_id")
    .in("org_id", [...orgs.keys()])
    .is("archived_at", null)
    .order("created_at");
  if (error) throw error;

  const editable = new Set(editorOf.data.map((row) => row.project_id));
  return projects.flatMap((project) => {
    const org = orgs.get(project.org_id);
    if (!org || !(org.manager || editable.has(project.id))) return [];
    return [
      {
        id: project.id,
        name: project.name,
        orgId: project.org_id,
        orgName: org.name,
        timezone: org.timezone,
      },
    ];
  });
}
