"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { orgPath } from "@/components/layout/nav";
import { requireOrg } from "@/features/organizations/queries";
import { requireUserId } from "@/lib/auth/session";
import { canCreateProject } from "@/lib/billing/limits";
import { fieldErrorsFrom, type FormState, textField } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { projectsCopy } from "./copy";
import { getProjectAccess } from "./queries";
import { type ProjectFormField, projectFormSchema } from "./schemas";

export type ProjectFormState = FormState<ProjectFormField>;

const { errors, limit } = projectsCopy;

function parseProjectForm(formData: FormData) {
  return projectFormSchema.safeParse({
    name: textField(formData, "name"),
    address: textField(formData, "address"),
    city: textField(formData, "city"),
    state: textField(formData, "state"),
    builtArea: textField(formData, "builtArea"),
    standard: textField(formData, "standard"),
    startDate: textField(formData, "startDate"),
    status: textField(formData, "status") || undefined,
  });
}

/**
 * Cria a obra (as etapas padrão nascem junto, por gatilho no banco) e leva
 * para o painel dela. A auditoria também é gravada pelo banco.
 */
export async function createProject(
  orgSlug: string,
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const userId = await requireUserId();
  const org = await requireOrg(orgSlug);

  const parsed = parseProjectForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const allowed = await canCreateProject(supabase, org.id);
  if (!allowed.ok) {
    return {
      status: "error",
      message:
        allowed.reason === "max_projects"
          ? limit.maxProjects(allowed.limit ?? 1)
          : limit.inactive,
    };
  }

  const input = parsed.data;
  const { data, error } = await supabase
    .from("projects")
    .insert({
      org_id: org.id,
      name: input.name,
      address: input.address,
      city: input.city,
      state: input.state,
      built_area_m2: input.builtArea,
      standard: input.standard,
      start_date: input.startDate,
      status: input.status,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    // RLS: só dono e admin criam obras.
    return {
      status: "error",
      message:
        error?.code === "42501" ? errors.noPermission : errors.saveFailed,
    };
  }

  redirect(orgPath(org.slug, "obras", data.id));
}

export async function updateProject(
  orgSlug: string,
  projectId: string,
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  await requireUserId();
  const org = await requireOrg(orgSlug);
  const access = await getProjectAccess(org.id, projectId);
  if (!access.canEdit) return { status: "error", message: errors.noPermission };

  const parsed = parseProjectForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({
      name: input.name,
      address: input.address,
      city: input.city,
      state: input.state,
      built_area_m2: input.builtArea,
      standard: input.standard,
      start_date: input.startDate,
      status: input.status,
    })
    .eq("org_id", org.id)
    .eq("id", projectId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { status: "error", message: errors.saveFailed };

  refresh();
  return { status: "success", message: projectsCopy.edit.saved };
}

/** Arquiva ou reativa a obra. Reativar respeita o limite do plano. */
export async function setProjectArchived(
  orgSlug: string,
  projectId: string,
  archived: boolean,
): Promise<ProjectFormState> {
  await requireUserId();
  const org = await requireOrg(orgSlug);
  const access = await getProjectAccess(org.id, projectId);
  if (!access.isOrgAdmin) {
    return { status: "error", message: errors.noPermission };
  }

  const supabase = await createClient();
  if (!archived) {
    const allowed = await canCreateProject(supabase, org.id);
    if (!allowed.ok) {
      return {
        status: "error",
        message:
          allowed.reason === "max_projects"
            ? limit.maxProjects(allowed.limit ?? 1)
            : limit.inactive,
      };
    }
  }

  const { error } = await supabase
    .from("projects")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("org_id", org.id)
    .eq("id", projectId);
  if (error) return { status: "error", message: errors.saveFailed };

  redirect(
    archived
      ? orgPath(org.slug, "obras")
      : orgPath(org.slug, "obras", projectId),
  );
}
