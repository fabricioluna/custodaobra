"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { orgPath } from "@/components/layout/nav";
import { requireOrg } from "@/features/organizations/queries";
import { requireUserId } from "@/lib/auth/session";
import { canInviteMember } from "@/lib/billing/limits";
import {
  fieldErrorsFrom,
  type FormState,
  isUuid,
  textField,
} from "@/lib/forms";
import { getRequestOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";

import { membersCopy } from "./copy";
import { getOrgRole, isOrgAdminRole } from "./queries";
import {
  acceptInviteSchema,
  diffProjectAccess,
  type InviteFormField,
  inviteFormSchema,
  memberAccessSchema,
} from "./schemas";
import {
  generateInviteToken,
  hashInviteToken,
  isInviteTokenShape,
} from "./token";

const { errors } = membersCopy;

/** Dono ou admin da organização do endereço; senão, null. */
async function requireTeamManager(orgSlug: string) {
  const userId = await requireUserId();
  const org = await requireOrg(orgSlug);
  const role = await getOrgRole(org.id);
  return isOrgAdminRole(role) ? { userId, org } : null;
}

export type InviteFormState =
  | Exclude<FormState<InviteFormField>, { status: "success" }>
  | { status: "success"; link: string };

/**
 * Gera o convite e devolve o link (com o token em texto) uma única vez. O
 * banco guarda só o hash. O limite de membros do plano vem de limits.ts.
 */
export async function createInvitation(
  orgSlug: string,
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const manager = await requireTeamManager(orgSlug);
  if (!manager) return { status: "error", message: errors.noPermission };

  const parsed = inviteFormSchema.safeParse({
    scope: textField(formData, "scope"),
    projectId: textField(formData, "projectId"),
    projectRole: textField(formData, "projectRole") || undefined,
    label: textField(formData, "label"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const allowed = await canInviteMember(supabase, manager.org.id);
  if (!allowed.ok) {
    return {
      status: "error",
      message:
        allowed.reason === "max_members"
          ? errors.maxMembers(allowed.limit ?? 1)
          : errors.inactive,
    };
  }

  const input = parsed.data;
  const token = generateInviteToken();
  const { error } = await supabase.from("invitations").insert({
    org_id: manager.org.id,
    project_id: input.scope === "project" ? input.projectId : null,
    org_role: input.scope === "project" ? "member" : "admin",
    project_role: input.scope === "project" ? input.projectRole : null,
    label: input.label,
    token_hash: hashInviteToken(token),
    invited_by: manager.userId,
  });
  if (error) {
    return {
      status: "error",
      message: error.code === "42501" ? errors.noPermission : errors.saveFailed,
    };
  }

  const origin = await getRequestOrigin();
  return { status: "success", link: `${origin}/convite/${token}` };
}

export async function cancelInvitation(
  orgSlug: string,
  invitationId: string,
): Promise<FormState<never>> {
  const manager = await requireTeamManager(orgSlug);
  if (!manager) return { status: "error", message: errors.noPermission };
  if (!isUuid(invitationId))
    return { status: "error", message: errors.saveFailed };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("org_id", manager.org.id)
    .eq("id", invitationId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { status: "error", message: errors.saveFailed };

  refresh();
  return { status: "success" };
}

/**
 * Papel na conta e acesso por obra de uma pessoa. O dono não muda (o RLS
 * também barra). Administrador já vê todas as obras, então o acesso por obra
 * só é gravado para quem fica como membro.
 */
export async function updateMemberAccess(
  orgSlug: string,
  memberId: string,
  _prev: FormState<never>,
  formData: FormData,
): Promise<FormState<never>> {
  const manager = await requireTeamManager(orgSlug);
  if (!manager) return { status: "error", message: errors.noPermission };
  if (!isUuid(memberId)) return { status: "error", message: errors.saveFailed };

  const projects: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("project:") && typeof value === "string") {
      projects[key.slice("project:".length)] = value;
    }
  }
  const parsed = memberAccessSchema.safeParse({
    role: textField(formData, "role"),
    projects,
  });
  if (!parsed.success) return { status: "error", message: errors.saveFailed };

  const supabase = await createClient();
  const orgId = manager.org.id;
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", memberId)
    .maybeSingle();
  if (!member || member.role === "owner") {
    return { status: "error", message: errors.saveFailed };
  }

  const { role } = parsed.data;
  if (member.role !== role) {
    const { error } = await supabase
      .from("organization_members")
      .update({ role })
      .eq("org_id", orgId)
      .eq("user_id", memberId);
    if (error) return { status: "error", message: errors.saveFailed };
  }

  if (role === "member") {
    const { data: rows } = await supabase
      .from("project_members")
      .select("project_id, role")
      .eq("org_id", orgId)
      .eq("user_id", memberId);
    const current = Object.fromEntries(
      (rows ?? []).map((row) => [row.project_id, row.role]),
    );
    const diff = diffProjectAccess(current, parsed.data.projects);

    const results = await Promise.all([
      diff.insert.length
        ? supabase.from("project_members").insert(
            diff.insert.map((item) => ({
              org_id: orgId,
              project_id: item.projectId,
              user_id: memberId,
              role: item.role,
            })),
          )
        : null,
      ...diff.update.map((item) =>
        supabase
          .from("project_members")
          .update({ role: item.role })
          .eq("project_id", item.projectId)
          .eq("user_id", memberId),
      ),
      diff.remove.length
        ? supabase
            .from("project_members")
            .delete()
            .eq("user_id", memberId)
            .in("project_id", diff.remove)
        : null,
    ]);
    if (results.some((result) => result?.error)) {
      return { status: "error", message: errors.saveFailed };
    }
  }

  refresh();
  // Quem tirou o próprio papel de admin não cuida mais da equipe.
  if (memberId === manager.userId && role === "member") {
    redirect(orgPath(manager.org.slug, "obras"));
  }
  return { status: "success", message: membersCopy.member.saved };
}

/** Tira a pessoa da organização (o acesso às obras vai junto, em cascata). */
export async function removeMember(
  orgSlug: string,
  memberId: string,
): Promise<FormState<never>> {
  const manager = await requireTeamManager(orgSlug);
  if (!manager) return { status: "error", message: errors.noPermission };
  if (!isUuid(memberId)) return { status: "error", message: errors.saveFailed };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .delete()
    .eq("org_id", manager.org.id)
    .eq("user_id", memberId)
    .neq("role", "owner")
    .select("user_id")
    .maybeSingle();
  if (error || !data) return { status: "error", message: errors.saveFailed };

  refresh();
  if (memberId === manager.userId) redirect("/inicio");
  redirect(orgPath(manager.org.slug, "configuracoes", "equipe"));
}

export type AcceptInviteState = FormState<"fullName">;

const acceptErrors: Record<string, string> = {
  invitation_used: membersCopy.accept.used,
  invitation_expired: membersCopy.accept.expired,
  invitation_revoked: membersCopy.accept.revoked,
  invitation_not_found: membersCopy.accept.invalid,
};

/**
 * Aceita o convite e leva para a obra. Quem chegou agora (sem primeiro
 * acesso) informa só o nome: não precisa escolher nome de conta, porque vai
 * trabalhar na conta de quem convidou. A conta pessoal fica com o nome dela.
 */
export async function acceptInvitation(
  token: string,
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const userId = await requireUserId();
  if (!isInviteTokenShape(token)) {
    return { status: "error", message: membersCopy.accept.invalid };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at, default_org_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return { status: "error", message: errors.saveFailed };

  let fullName: string | null = null;
  if (!profile.onboarded_at) {
    const parsed = acceptInviteSchema.safeParse({
      fullName: textField(formData, "fullName"),
    });
    if (!parsed.success) {
      return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
    }
    fullName = parsed.data.fullName;
  }
  const personalOrgId = profile.default_org_id;

  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });
  const accepted = data?.[0];
  if (error || !accepted) {
    return {
      status: "error",
      message: acceptErrors[error?.message ?? ""] ?? errors.saveFailed,
    };
  }

  if (fullName) {
    // Primeiro acesso pelo convite: o nome da pessoa vira também o nome da
    // conta pessoal (que nasceu com o começo do e-mail).
    if (personalOrgId) {
      await supabase
        .from("organizations")
        .update({ name: fullName.slice(0, 80) })
        .eq("id", personalOrgId)
        .eq("kind", "personal");
    }
    await supabase
      .from("profiles")
      .update({ full_name: fullName, onboarded_at: new Date().toISOString() })
      .eq("id", userId);
  }

  // Os tipos gerados não marcam project_id como anulável.
  const projectId = accepted.project_id as string | null;
  redirect(
    projectId
      ? orgPath(accepted.org_slug, "obras", projectId)
      : orgPath(accepted.org_slug, "obras"),
  );
}
