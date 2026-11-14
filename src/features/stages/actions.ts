"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireOrg } from "@/features/organizations/queries";
import { getProjectAccess } from "@/features/projects/queries";
import { requireUserId } from "@/lib/auth/session";
import { type FormState, textField } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { stagesCopy } from "./copy";
import { findOrCreateStage } from "./create";
import { parseBudgetForm, parseProgressForm } from "./schemas";

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
  const stage = await findOrCreateStage(
    supabase,
    org.id,
    projectId,
    parsed.data,
  );
  if (!stage) return { status: "error", message: errors.saveFailed };
  if (!stage.created) {
    return { status: "error", fieldErrors: { name: errors.nameExists } };
  }

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

export type StagePlanFormState = FormState<"area">;

/** Ids das etapas da obra (o que vier de fora disso é ignorado). */
async function projectStageIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
) {
  const { data } = await supabase
    .from("stages")
    .select("id")
    .eq("project_id", projectId);
  return new Set((data ?? []).map((stage) => stage.id));
}

/** Salva o previsto de todas as etapas (e a estimativa usada, se houver). */
export async function saveStageBudgets(
  orgSlug: string,
  projectId: string,
  _prev: StagePlanFormState,
  formData: FormData,
): Promise<StagePlanFormState> {
  const org = await guard(orgSlug, projectId);
  if (!org) return { status: "error", message: errors.noPermission };

  const supabase = await createClient();
  const parsed = parseBudgetForm(
    [...formData.entries()],
    await projectStageIds(supabase, projectId),
  );
  if (!parsed.ok) {
    return parsed.field
      ? { status: "error", fieldErrors: { area: parsed.message } }
      : { status: "error", message: parsed.message };
  }

  if (parsed.estimate) {
    const { error } = await supabase
      .from("projects")
      .update({
        built_area_m2: parsed.estimate.areaM2,
        cost_per_m2_cents: parsed.estimate.costPerM2Cents,
      })
      .eq("org_id", org.id)
      .eq("id", projectId);
    if (error) return { status: "error", message: errors.saveFailed };
  }

  const { error } = await supabase.rpc("update_stage_plan", {
    p_project_id: projectId,
    p_items: parsed.items,
  });
  if (error) return { status: "error", message: errors.saveFailed };

  refresh();
  return { status: "success", message: stagesCopy.budget.saved };
}

/** Salva o progresso informado de todas as etapas. */
export async function saveStageProgress(
  orgSlug: string,
  projectId: string,
  _prev: StagePlanFormState,
  formData: FormData,
): Promise<StagePlanFormState> {
  const org = await guard(orgSlug, projectId);
  if (!org) return { status: "error", message: errors.noPermission };

  const supabase = await createClient();
  const parsed = parseProgressForm(
    [...formData.entries()],
    await projectStageIds(supabase, projectId),
  );
  if (!parsed.ok) return { status: "error", message: parsed.message };

  const { error } = await supabase.rpc("update_stage_plan", {
    p_project_id: projectId,
    p_items: parsed.items,
  });
  if (error) return { status: "error", message: errors.saveFailed };

  refresh();
  return { status: "success", message: stagesCopy.progress.saved };
}
