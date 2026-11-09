import { Calculator, ListOrdered, Percent } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { orgPath } from "@/components/layout/nav";
import { buttonVariants } from "@/components/ui/button";
import { requireProject } from "@/features/projects/queries";
import { PlanSummary } from "@/features/stages/components/plan-summary";
import { StagePlanList } from "@/features/stages/components/stage-plan-list";
import { stagesCopy as copy } from "@/features/stages/copy";
import { getStagePlans, summarizePlans } from "@/features/stages/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: copy.title };

export default async function StagesPage({
  params,
}: PageProps<"/o/[orgSlug]/obras/[projectId]/etapas">) {
  const { orgSlug, projectId } = await params;
  const { org, project, access } = await requireProject(orgSlug, projectId);
  const plans = await getStagePlans(project.id);
  const summary = summarizePlans(plans);
  const base = orgPath(org.slug, "obras", project.id);

  const links = access.canEdit ? (
    <div className="mb-6 flex flex-wrap gap-2">
      <Link
        href={`${base}/etapas/orcamento`}
        className={cn(
          buttonVariants({
            variant: summary.hasBudget ? "outline" : "default",
            size: "lg",
          }),
          "rounded-xl",
        )}
      >
        <Calculator aria-hidden />
        {summary.hasBudget
          ? copy.overview.budgetLink
          : copy.overview.noBudgetAction}
      </Link>
      <Link
        href={`${base}/etapas/progresso`}
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "rounded-xl",
        )}
      >
        <Percent aria-hidden />
        {copy.overview.progressLink}
      </Link>
      <Link
        href={`${base}/etapas/organizar`}
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "rounded-xl",
        )}
      >
        <ListOrdered aria-hidden />
        {copy.overview.organizeLink}
      </Link>
    </div>
  ) : null;

  return (
    <>
      <p className="mb-4 max-w-prose text-muted-foreground">
        {copy.overview.description}
      </p>
      {links}
      {summary.hasBudget ? (
        <PlanSummary summary={summary} className="mb-6" />
      ) : (
        <div className="mb-6 max-w-2xl rounded-2xl border border-dashed p-4 md:p-5">
          <h2 className="text-lg heading">{copy.overview.noBudgetTitle}</h2>
          <p className="mt-1 text-muted-foreground">
            {copy.overview.noBudgetDescription}
          </p>
        </div>
      )}
      <section
        aria-label={copy.title}
        className="max-w-2xl rounded-2xl border bg-card p-4 md:p-5"
      >
        <StagePlanList
          plans={plans}
          hrefFor={(stageId) => `${base}/lancamentos?etapa=${stageId}`}
        />
      </section>
    </>
  );
}
