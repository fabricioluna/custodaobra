import type { Metadata } from "next";

import { FormMessage } from "@/components/form-message";
import { orgPath } from "@/components/layout/nav";
import { requireProject } from "@/features/projects/queries";
import {
  addStage,
  moveStage,
  removeStage,
  renameStage,
} from "@/features/stages/actions";
import { StageEditor } from "@/features/stages/components/stage-editor";
import { StageSubpageHeader } from "@/features/stages/components/stage-subpage-header";
import { stagesCopy as copy } from "@/features/stages/copy";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: copy.organize.title };

export default async function OrganizeStagesPage({
  params,
}: PageProps<"/o/[orgSlug]/obras/[projectId]/etapas/organizar">) {
  const { orgSlug, projectId } = await params;
  const { org, project, access } = await requireProject(orgSlug, projectId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("v_stage_summary")
    .select("stage_id, name, expense_count")
    .eq("project_id", project.id)
    .order("sort_order");
  const stages = (data ?? []).map((stage) => ({
    id: stage.stage_id ?? "",
    name: stage.name ?? "",
    expenseCount: stage.expense_count ?? 0,
  }));

  return (
    <>
      <StageSubpageHeader
        backHref={orgPath(org.slug, "obras", project.id, "etapas")}
        title={copy.organize.title}
        description={copy.description}
      />
      {access.canEdit ? (
        <StageEditor
          stages={stages}
          actions={{
            rename: renameStage.bind(null, org.slug, project.id),
            move: moveStage.bind(null, org.slug, project.id),
            remove: removeStage.bind(null, org.slug, project.id),
            add: addStage.bind(null, org.slug, project.id),
          }}
        />
      ) : (
        <>
          <FormMessage className="mb-4 max-w-2xl">{copy.readOnly}</FormMessage>
          <ol className="flex max-w-2xl flex-col divide-y rounded-2xl border bg-card">
            {stages.map((stage, index) => (
              <li key={stage.id} className="flex gap-3 px-4 py-3">
                <span className="w-6 text-right font-bold text-muted-foreground">
                  {index + 1}
                </span>
                <span className="flex-1">{stage.name}</span>
                <span className="text-sm text-muted-foreground">
                  {copy.expenses(stage.expenseCount)}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
