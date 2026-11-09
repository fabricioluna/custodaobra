import { CalendarClock, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { FormMessage } from "@/components/form-message";
import { orgPath } from "@/components/layout/nav";
import { buttonVariants } from "@/components/ui/button";
import { PayableList } from "@/features/payables/components/payable-list";
import { payablesCopy } from "@/features/payables/copy";
import { dueState, summarizeOpen } from "@/features/payables/installments";
import { listProjectPayables } from "@/features/payables/queries";
import { requireProject } from "@/features/projects/queries";
import { todayIn } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const copy = payablesCopy.list;

export const metadata: Metadata = { title: copy.title };

export default async function ProjectPayablesPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/obras/[projectId]/contas">) {
  const { orgSlug, projectId } = await params;
  const { org, project, access } = await requireProject(orgSlug, projectId);
  const query = await searchParams;
  const { open, paid, cancelled } = await listProjectPayables(project.id);
  const today = todayIn(org.timezone);
  const base = orgPath(org.slug, "obras", project.id, "contas");
  const hrefFor = (payable: { id: string }) => `${base}/${payable.id}`;

  const savedCount = Number(query.salvo);
  const notice =
    savedCount > 0 ? (
      <FormMessage tone="success" className="mb-6">
        {savedCount > 1
          ? payablesCopy.edit.savedMany(savedCount)
          : payablesCopy.edit.savedNotice}
      </FormMessage>
    ) : typeof query.pago === "string" ? (
      <FormMessage tone="success" className="mb-6">
        {paidNotice(paid, query.pago)}
      </FormMessage>
    ) : null;

  const createLink = access.canEdit ? (
    <Link
      href={`${base}/nova`}
      className={cn(buttonVariants({ size: "lg" }), "rounded-xl")}
    >
      <Plus aria-hidden />
      {copy.create}
    </Link>
  ) : null;

  if (open.length + paid.length + cancelled.length === 0) {
    return (
      <>
        {notice}
        <EmptyState
          icon={CalendarClock}
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          action={createLink}
        />
      </>
    );
  }

  const totals = summarizeOpen(open, today);
  const overdue = open.filter((p) => dueState(p.due_date, today) === "overdue");
  const upcoming = open.filter(
    (p) => dueState(p.due_date, today) !== "overdue",
  );

  return (
    <>
      {notice}
      <p className="mb-4 max-w-prose text-muted-foreground">
        {copy.projectDescription}
      </p>

      <section
        aria-label={copy.totalOpen}
        className="mb-6 flex max-w-2xl flex-wrap items-end justify-between gap-4 rounded-2xl border bg-card p-4 md:p-5"
      >
        <div>
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
        </div>
        {createLink}
      </section>

      {open.length === 0 ? (
        <div className="mb-6 max-w-2xl rounded-2xl border border-dashed p-4 md:p-5">
          <h2 className="text-lg heading">{copy.allPaidTitle}</h2>
          <p className="mt-1 text-muted-foreground">
            {copy.allPaidDescription}
          </p>
        </div>
      ) : null}

      {overdue.length > 0 ? (
        <Group title={copy.overdue}>
          <PayableList payables={overdue} hrefFor={hrefFor} today={today} />
        </Group>
      ) : null}
      {upcoming.length > 0 ? (
        <Group title={copy.upcoming}>
          <PayableList payables={upcoming} hrefFor={hrefFor} today={today} />
        </Group>
      ) : null}
      {paid.length > 0 ? (
        <Group title={copy.paid}>
          <PayableList payables={paid} hrefFor={hrefFor} today={today} />
        </Group>
      ) : null}
      {cancelled.length > 0 ? (
        <details className="mb-6 max-w-2xl">
          <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold text-muted-foreground">
            {copy.cancelled} ({cancelled.length})
          </summary>
          <div className="mt-3">
            <PayableList payables={cancelled} hrefFor={hrefFor} today={today} />
          </div>
        </details>
      ) : null}
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mb-6 max-w-2xl">
      <h2 className="mb-3 text-lg heading">{title}</h2>
      {children}
    </section>
  );
}

function paidNotice(
  paid: { paid_expense: { id: string; amount_cents: number } | null }[],
  expenseId: string,
): string {
  const match = paid.find((p) => p.paid_expense?.id === expenseId);
  return match?.paid_expense
    ? payablesCopy.edit.paidSaved(formatCents(match.paid_expense.amount_cents))
    : payablesCopy.edit.paidSavedGeneric;
}
