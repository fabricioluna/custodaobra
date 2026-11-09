import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { orgPath } from "@/components/layout/nav";
import { requireProject } from "@/features/projects/queries";
import { saveStageProgress } from "@/features/stages/actions";
import { ProgressForm } from "@/features/stages/components/progress-form";
import { StageSubpageHeader } from "@/features/stages/components/stage-subpage-header";
import { stagesCopy } from "@/features/stages/copy";
import { getStagePlans } from "@/features/stages/queries";

const copy = stagesCopy.progress;

export const metadata: Metadata = { title: copy.title };

export default async function StageProgressPage({
  params,
}: PageProps<"/o/[orgSlug]/obras/[projectId]/etapas/progresso">) {
  const { orgSlug, projectId } = await params;
  const { org, project, access } = await requireProject(orgSlug, projectId);
  if (!access.canEdit) notFound();
  const plans = await getStagePlans(project.id);

  return (
    <>
      <StageSubpageHeader
        backHref={orgPath(org.slug, "obras", project.id, "etapas")}
        title={copy.title}
        description={copy.description}
      />
      <ProgressForm
        stages={plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          progressPercent: plan.progressPercent,
          spentPercent: plan.status.spentPercent,
        }))}
        action={saveStageProgress.bind(null, org.slug, project.id)}
      />
    </>
  );
}
