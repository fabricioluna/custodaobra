import "server-only";

import { cache } from "react";
import { z } from "zod";

import type { LaunchAccess } from "@/components/layout/nav";
import { getOrgBySlug } from "@/features/organizations/queries";
import { getUserId, requireUserId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { isInviteTokenShape } from "./token";

export type OrgRole = Database["public"]["Enums"]["org_role"];
export type ProjectRole = Database["public"]["Enums"]["project_role"];

/** Papel da pessoa logada na organização (null = não é membro). */
export const getOrgRole = cache(
  async (orgId: string): Promise<OrgRole | null> => {
    const userId = await requireUserId();
    const supabase = await createClient();
    const { data } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();
    return data?.role ?? null;
  },
);

export const isOrgAdminRole = (role: OrgRole | null) =>
  role === "owner" || role === "admin";

const teamProjectsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    role: z.enum(["editor", "viewer"]),
  }),
);

/** Equipe da organização (só dono e admin recebem linhas). */
export const listTeam = cache(async (orgId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("org_team", { p_org_id: orgId });
  return (data ?? []).map((member) => ({
    userId: member.user_id,
    // Os tipos gerados não marcam colunas de função como anuláveis.
    fullName: member.full_name as string | null,
    email: member.email as string | null,
    role: member.role,
    joinedAt: member.joined_at,
    projects: teamProjectsSchema.catch([]).parse(member.projects),
  }));
});

export type TeamMember = Awaited<ReturnType<typeof listTeam>>[number];

/** Convites ainda válidos, mais recentes primeiro. */
export async function listPendingInvitations(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invitations")
    .select(
      "id, label, org_role, project_id, project_role, expires_at, created_at, projects(name)",
    )
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type PendingInvitation = Awaited<
  ReturnType<typeof listPendingInvitations>
>[number];

/** Quantas pessoas o plano permite (para mostrar o uso na tela). */
export async function getMaxMembers(orgId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("plans!subscriptions_plan_code_fkey(max_members)")
    .eq("org_id", orgId)
    .maybeSingle();
  return data?.plans?.max_members ?? null;
}

/**
 * Onde a pessoa pode lançar gastos, para a tecla "Lançar gasto": todas as
 * obras (dono e admin) ou só as obras em que é editor.
 */
export async function getLaunchAccess(orgSlug: string): Promise<LaunchAccess> {
  const none: LaunchAccess = { all: false, projectIds: [] };
  const userId = await getUserId();
  if (!userId) return none;
  const org = await getOrgBySlug(orgSlug);
  if (!org) return none;
  const role = await getOrgRole(org.id);
  if (isOrgAdminRole(role)) return { all: true, projectIds: [] };

  const supabase = await createClient();
  const { data } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("org_id", org.id)
    .eq("user_id", userId)
    .eq("role", "editor");
  return { all: false, projectIds: data?.map((row) => row.project_id) ?? [] };
}

/** Resumo do convite para a tela pública. null = não existe. */
export async function getInvitation(token: string) {
  if (!isInviteTokenShape(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation", { p_token: token });
  const row = data?.[0];
  if (!row) return null;
  return {
    orgName: row.org_name,
    // Os tipos gerados não marcam colunas de função como anuláveis.
    projectName: row.project_name as string | null,
    inviterName: row.inviter_name as string | null,
    orgRole: row.org_role,
    projectRole: row.project_role as ProjectRole | null,
    status: row.status as "pending" | "accepted" | "expired" | "revoked",
  };
}

/** Contas (organizações) de que a pessoa logada participa, para trocar. */
export async function listMyOrgs() {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, slug)")
    .eq("user_id", userId)
    .order("created_at");
  return (data ?? []).flatMap((row) =>
    row.organizations ? [{ ...row.organizations, role: row.role }] : [],
  );
}
