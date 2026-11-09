import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { orgPath } from "@/components/layout/nav";
import { PageHeader } from "@/components/layout/page-header";
import { requireOrg } from "@/features/organizations/queries";
import { PayableList } from "@/features/payables/components/payable-list";
import { payablesCopy } from "@/features/payables/copy";
import { dueState, summarizeOpen } from "@/features/payables/installments";
import { listOrgOpenPayables } from "@/features/payables/queries";
import { ProjectPicker } from "@/features/projects/components/project-picker";
import { listProjects } from "@/features/projects/queries";
import { todayIn } from "@/lib/dates";
import { formatCents } from "@/lib/money";

const copy = payablesCopy.list;

export const metadata: Metadata = { title: copy.title };

/**
 * Contas de todas as obras juntas, por vencimento. Com uma obra só, abre as
 * contas dela (onde dá para cadastrar e ver as pagas).
 */
export default async function PayablesPage({
  params,
}: PageProps<"/o/[orgSlug]/contas">) {
  const { orgSlug } = await params;
  const org = await requireOrg(orgSlug);
  const projects = await listProjects(org.id);
  const projectHref = (projectId: string) =>
    orgPath(org.slug, "obras", projectId, "contas");

  if (projects.length === 1) redirect(projectHref(projects[0].id));

  if (projects.length === 0) {
    return (
      <>
        <PageHeader title={copy.title} description={copy.description} />
        <EmptyState
          icon={CalendarClock}
          title={copy.emptyTitle}
          description={copy.noProjectsDescription}
        />
      </>
    );
  }

  const open = await listOrgOpenPayables(org.id);
  const today = todayIn(org.timezone);
  const totals = summarizeOpen(open, today);
  const overdue = open.filter((p) => dueState(p.due_date, today) === "overdue");
  const upcoming = open.filter(
    (p) => dueState(p.due_date, today) !== "overdue",
  );
  const hrefFor = (payable: { id: string; project_id: string }) =>
    `${projectHref(payable.project_id)}/${payable.id}`;

  return (
    <>
      <PageHeader title={copy.title} description={copy.description} />

      {open.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      ) : (
        <>
          <section
            aria-label={copy.totalOpen}
            className="mb-6 max-w-2xl rounded-2xl border bg-card p-4 md:p-5"
          >
            <p className="text-sm font-medium text-muted-foreground">
              {copy.totalOpen}
            </p>
            <p className="mt-1 text-3xl font-extrabold money">
              {formatCents(totals.totalCents)}
            </p>
            {totals.overdueCount > 0 ? (
              <p className="mt-1 text-sm font-semibold text-status-danger">
                {copy.overdueTotal(
                  formatCents(totals.overdueCents),
                  totals.overdueCount,
                )}
              </p>
            ) : null}
            {totals.soonCents > 0 ? (
              <p className="mt-1 text-sm font-medium text-status-warn">
                {copy.soonTotal(formatCents(totals.soonCents))}
              </p>
            ) : null}
          </section>
          {overdue.length > 0 ? (
            <section aria-label={copy.overdue} className="mb-6 max-w-2xl">
              <h2 className="mb-3 text-lg heading">{copy.overdue}</h2>
              <PayableList
                payables={overdue}
                hrefFor={hrefFor}
                today={today}
                showProject
              />
            </section>
          ) : null}
          {upcoming.length > 0 ? (
            <section aria-label={copy.upcoming} className="mb-6 max-w-2xl">
              <h2 className="mb-3 text-lg heading">{copy.upcoming}</h2>
              <PayableList
                payables={upcoming}
                hrefFor={hrefFor}
                today={today}
                showProject
              />
            </section>
          ) : null}
        </>
      )}

      <h2 className="mt-8 mb-3 text-lg heading">{copy.byProject}</h2>
      <ProjectPicker projects={projects} hrefFor={projectHref} />
    </>
  );
}
