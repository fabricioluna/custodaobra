import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { orgPath } from "@/components/layout/nav";
import { requireProject } from "@/features/projects/queries";
import { saveStageBudgets } from "@/features/stages/actions";
import { BudgetForm } from "@/features/stages/components/budget-form";
import { StageSubpageHeader } from "@/features/stages/components/stage-subpage-header";
import { stagesCopy } from "@/features/stages/copy";
import { getBudgetFormData } from "@/features/stages/queries";

const copy = stagesCopy.budget;

export const metadata: Metadata = { title: copy.title };

export default async function StageBudgetPage({
  params,
}: PageProps<"/o/[orgSlug]/obras/[projectId]/etapas/orcamento">) {
  const { orgSlug, projectId } = await params;
  const { org, project, access } = await requireProject(orgSlug, projectId);
  if (!access.canEdit) notFound();
  const data = await getBudgetFormData(project.id);

  return (
    <>
      <StageSubpageHeader
        backHref={orgPath(org.slug, "obras", project.id, "etapas")}
        title={copy.title}
        description={copy.description}
      />
      <BudgetForm
        stages={data.stages}
        areaM2={data.areaM2}
        costPerM2Cents={data.costPerM2Cents}
        action={saveStageBudgets.bind(null, org.slug, project.id)}
      />
    </>
  );
}
