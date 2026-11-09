"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireOrg } from "@/features/organizations/queries";
import { getProjectAccess } from "@/features/projects/queries";
import { requireUserId } from "@/lib/auth/session";
import { type FormState, textField } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { stagesCopy } from "./copy";

export type StageFormState = FormState<"name">;

const { errors } = stagesCopy;

const nameSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1, { error: errors.nameRequired })
      .max(80, { error: errors.nameTooLong }),
  );

/** Confere sessão e permissão de edição na obra. */
async function guard(orgSlug: string, projectId: string) {
  await requireUserId();
  const org = await requireOrg(orgSlug);
  const access = await getProjectAccess(org.id, projectId);
  return access.canEdit ? org : null;
}

export async function renameStage(
  orgSlug: string,
  projectId: string,
  stageId: string,
  _prev: StageFormState,
  formData: FormData,
): Promise<StageFormState> {
  const org = await guard(orgSlug, projectId);
  if (!org) return { status: "error", message: errors.noPermission };

  const parsed = nameSchema.safeParse(textField(formData, "name"));
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: { name: parsed.error.issues[0]?.message },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("stages")
    .update({ name: parsed.data })
    .eq("project_id", projectId)
    .eq("id", stageId);
  if (error) return { status: "error", message: errors.saveFailed };

  refresh();
  return { status: "success" };
}

export async function addStage(
  orgSlug: string,
  projectId: string,
  _prev: StageFormState,
  formData: FormData,
): Promise<StageFormState> {
  const org = await guard(orgSlug, projectId);
  if (!org) return { status: "error", message: errors.noPermission };

  const parsed = nameSchema.safeParse(textField(formData, "name"));
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: { name: parsed.error.issues[0]?.message },
    };
  }

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("stages")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("stages").insert({
    org_id: org.id,
    project_id: projectId,
    name: parsed.data,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return { status: "error", message: errors.saveFailed };

  refresh();
  return { status: "success" };
}

/** Troca a etapa de lugar com a vizinha de cima ou de baixo. */
export async function moveStage(
  orgSlug: string,
  projectId: string,
  stageId: string,
  direction: "up" | "down",
): Promise<StageFormState> {
  const org = await guard(orgSlug, projectId);
  if (!org) return { status: "error", message: errors.noPermission };

  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("stages")
    .select("id, sort_order")
    .eq("project_id", projectId)
    .order("sort_order")
    .order("created_at");
  if (!stages) return { status: "error", message: errors.saveFailed };

  const index = stages.findIndex((stage) => stage.id === stageId);
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || neighborIndex < 0 || neighborIndex >= stages.length) {
    return { status: "idle" };
  }

  // Renumera tudo na ordem nova (corrige também números repetidos).
  const ordered = [...stages];
  [ordered[index], ordered[neighborIndex]] = [
    ordered[neighborIndex],
    ordered[index],
  ];
  const updates = ordered
    .map((stage, position) => ({ id: stage.id, sort_order: position + 1 }))
    .filter(
      (stage) =>
        stages.find((original) => original.id === stage.id)?.sort_order !==
        stage.sort_order,
    );

  for (const update of updates) {
    const { error } = await supabase
      .from("stages")
      .update({ sort_order: update.sort_order })
      .eq("project_id", projectId)
      .eq("id", update.id);
    if (error) return { status: "error", message: errors.saveFailed };
  }

  refresh();
  return { status: "success" };
}

/** Remove a etapa. Os gastos dela ficam sem etapa ("Para classificar"). */
export async function removeStage(
  orgSlug: string,
  projectId: string,
  stageId: string,
): Promise<StageFormState> {
  const org = await guard(orgSlug, projectId);
  if (!org) return { status: "error", message: errors.noPermission };

  const supabase = await createClient();
  const { error } = await supabase
    .from("stages")
    .delete()
    .eq("project_id", projectId)
    .eq("id", stageId);
  if (error) return { status: "error", message: errors.saveFailed };

  refresh();
  return { status: "success" };
}
