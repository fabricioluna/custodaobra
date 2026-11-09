import { FileText, Plus, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { FormMessage } from "@/components/form-message";
import { orgPath } from "@/components/layout/nav";
import { buttonVariants } from "@/components/ui/button";
import { ExpenseList } from "@/features/expenses/components/expense-list";
import { getProjectDashboard } from "@/features/expenses/queries";
import { PayableList } from "@/features/payables/components/payable-list";
import { payablesCopy } from "@/features/payables/copy";
import { summarizeOpen } from "@/features/payables/installments";
import { listUpcomingPayables } from "@/features/payables/queries";
import { BarList } from "@/features/projects/components/bar-list";
import { projectsCopy } from "@/features/projects/copy";
import { requireProject } from "@/features/projects/queries";
import { reportsCopy } from "@/features/reports/copy";
import { PlanSummary } from "@/features/stages/components/plan-summary";
import { StagePlanList } from "@/features/stages/components/stage-plan-list";
import { getStagePlans, summarizePlans } from "@/features/stages/queries";
import { formatMonth, todayIn } from "@/lib/dates";
import { formatCents, formatCentsCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

const copy = projectsCopy.dashboard;

export const metadata: Metadata = { title: copy.title };

export default async function ProjectDashboardPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/obras/[projectId]">) {
  const { orgSlug, projectId } = await params;
  const { org, project, access } = await requireProject(orgSlug, projectId);
  const query = await searchParams;
  const [dashboard, plans, payables] = await Promise.all([
    getProjectDashboard(project.id),
    getStagePlans(project.id),
    listUpcomingPayables(project.id),
  ]);
  const plan = summarizePlans(plans);
  const today = todayIn(org.timezone);

  const base = orgPath(org.slug, "obras", project.id);
  const expenseHref = (id: string) => `${base}/lancamentos/${id}`;
  const launchHref = `${base}/lancamentos/novo`;
  const stageHref = (stageId: string) => `${base}/lancamentos?etapa=${stageId}`;
  const { summary } = dashboard;

  const savedId = typeof query.lancado === "string" ? query.lancado : null;
  const saved = savedId
    ? dashboard.recent.find((expense) => expense.id === savedId)
    : null;

  const notice = savedId ? (
    <div className="mb-6 flex flex-col gap-3">
      <FormMessage tone="success">
        {saved
          ? copy.savedNotice(formatCents(saved.amount_cents))
          : copy.savedGeneric}
      </FormMessage>
      {query.aviso === "comprovante" ? (
        <FormMessage>{copy.receiptWarning}</FormMessage>
      ) : null}
      {access.canEdit ? (
        <Link
          href={launchHref}
          className={cn(
            buttonVariants({ variant: "action", size: "lg" }),
            "self-start rounded-xl",
          )}
        >
          <Plus aria-hidden />
          {copy.launchAnother}
        </Link>
      ) : null}
    </div>
  ) : null;

  if (summary.expense_count === 0) {
    return (
      <>
        {notice}
        <EmptyState
          icon={ReceiptText}
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          action={
            access.canEdit ? (
              <Link
                href={launchHref}
                className={cn(
                  buttonVariants({ variant: "action", size: "lg" }),
                  "rounded-xl",
                )}
              >
                <Plus aria-hidden />
                {copy.launch}
              </Link>
            ) : null
          }
        />
      </>
    );
  }

  const area = project.built_area_m2;
  const constructionCents = summary.construction_cents ?? 0;
  const perM2 =
    area && constructionCents > 0 ? Math.round(constructionCents / area) : null;
  const stagesWithSpending = dashboard.stages.filter(
    (stage) => (stage.spent_cents ?? 0) > 0,
  );
  const quietStages = dashboard.stages.filter(
    (stage) => (stage.spent_cents ?? 0) === 0,
  );

  return (
    <>
      {notice}

      <section
        aria-label={copy.construction}
        className="mb-6 rounded-2xl bg-primary p-5 text-primary-foreground md:p-6"
      >
        <p className="text-sm font-medium text-primary-foreground/80">
          {copy.construction}
        </p>
        <p className="mt-1 text-4xl font-extrabold money md:text-5xl">
          {formatCents(summary.construction_cents ?? 0)}
        </p>
        {perM2 ? (
          <p className="mt-2 text-sm text-primary-foreground/80">
            {copy.perSquareMeter(formatCents(perM2))}
          </p>
        ) : null}
        {(summary.land_cents ?? 0) > 0 ? (
          <div className="mt-4 border-t border-primary-foreground/15 pt-4">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-primary-foreground/80">
                {copy.land}
              </span>
              <span className="text-lg font-bold money">
                {formatCents(summary.land_cents ?? 0)}
              </span>
            </p>
            <p className="mt-1 text-sm text-primary-foreground/70">
              {copy.totalInvested(
                formatCents(
                  (summary.construction_cents ?? 0) + (summary.land_cents ?? 0),
                ),
              )}
            </p>
          </div>
        ) : null}
      </section>

      {plan.alerts.length > 0 ? (
        <Section title={copy.alertsTitle}>
          <StagePlanList plans={plan.alerts} hrefFor={stageHref} />
        </Section>
      ) : null}

      {payables.upcoming.length > 0 ? (
        <Section title={copy.payablesTitle}>
          <PayablesTotals open={payables.open} today={today} />
          <PayableList
            payables={payables.upcoming}
            hrefFor={(payable) => `${base}/contas/${payable.id}`}
            today={today}
          />
          <Link
            href={`${base}/contas`}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "mt-4 rounded-xl",
            )}
          >
            {copy.payablesSeeAll}
          </Link>
        </Section>
      ) : null}

      {dashboard.unclassified.length > 0 ? (
        <Section title={copy.unclassifiedTitle}>
          <p className="mb-3 text-sm text-muted-foreground">
            {copy.unclassifiedDescription(dashboard.unclassified.length)}
          </p>
          <ExpenseList
            expenses={dashboard.unclassified}
            hrefFor={expenseHref}
            today={today}
          />
        </Section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={copy.byStage}>
          {plan.hasBudget ? (
            <>
              <PlanSummary
                summary={plan}
                className="mb-5 border-0 bg-transparent p-0 md:p-0"
              />
              <StagePlanList plans={plans} hrefFor={stageHref} />
            </>
          ) : (
            <>
              <BarList
                items={[...stagesWithSpending, ...quietStages].map((stage) => ({
                  key: stage.stage_id ?? stage.name ?? "",
                  label: stage.name ?? "",
                  cents: stage.spent_cents ?? 0,
                  muted: (stage.spent_cents ?? 0) === 0,
                  href: stage.stage_id ? stageHref(stage.stage_id) : undefined,
                }))}
                emptyLabel={copy.noSpending}
              />
              <p className="mt-4 text-sm text-muted-foreground">
                {copy.byStageHint}
              </p>
              {access.canEdit ? (
                <Link
                  href={`${base}/etapas/orcamento`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "mt-4 rounded-xl",
                  )}
                >
                  {copy.defineBudget}
                </Link>
              ) : null}
            </>
          )}
        </Section>

        <div className="flex flex-col gap-6">
          <Section title={copy.byCategory}>
            <BarList
              items={dashboard.categories.map((category) => ({
                key: category.category_id ?? "",
                label: category.category_name ?? "",
                cents: category.total_cents ?? 0,
                href: category.category_id
                  ? `${base}/lancamentos?categoria=${category.category_id}`
                  : undefined,
              }))}
            />
          </Section>

          {dashboard.months.length > 0 ? (
            <Section title={copy.byMonth}>
              <MonthBars months={dashboard.months} />
            </Section>
          ) : null}
        </div>
      </div>

      <Section title={copy.recent}>
        <ExpenseList
          expenses={dashboard.recent}
          hrefFor={expenseHref}
          today={today}
        />
        <Link
          href={`${base}/lancamentos`}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "mt-4 rounded-xl",
          )}
        >
          {copy.seeAll}
        </Link>
      </Section>

      <Link
        href={`${base}/relatorio`}
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "rounded-xl",
        )}
      >
        <FileText aria-hidden />
        {reportsCopy.link}
      </Link>
    </>
  );
}

/** Total em aberto, com o atrasado e o que vence logo em destaque. */
function PayablesTotals({
  open,
  today,
}: {
  open: { amount_cents: number; due_date: string }[];
  today: string;
}) {
  const totals = summarizeOpen(open, today);
  const list = payablesCopy.list;
  return (
    <div className="mb-4">
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground">{list.totalOpen}</span>
        <span className="text-lg font-bold money">
          {formatCents(totals.totalCents)}
        </span>
      </p>
      {totals.overdueCount > 0 ? (
        <p className="mt-1 text-sm font-semibold text-status-danger">
          {list.overdueTotal(
            formatCents(totals.overdueCents),
            totals.overdueCount,
          )}
        </p>
      ) : null}
      {totals.soonCents > 0 ? (
        <p className="mt-1 text-sm font-medium text-status-warn">
          {list.soonTotal(formatCents(totals.soonCents))}
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="mb-6 rounded-2xl border bg-card p-4 md:p-5"
    >
      <h2 className="mb-4 text-lg heading">{title}</h2>
      {children}
    </section>
  );
}

/** Colunas por mês (construção). Terreno fica de fora, como no total. */
function MonthBars({
  months,
}: {
  months: {
    month: string | null;
    construction_cents: number | null;
    land_cents: number | null;
  }[];
}) {
  const max = Math.max(1, ...months.map((m) => m.construction_cents ?? 0));
  return (
    <ol className="flex h-44 items-end gap-2 overflow-x-auto pb-1">
      {months.map((month) => {
        const cents = month.construction_cents ?? 0;
        const height = cents > 0 ? Math.max(3, (cents / max) * 100) : 0;
        const label = month.month ? formatMonth(month.month) : "";
        return (
          <li
            key={month.month}
            className="flex h-full min-w-12 flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="text-xs font-semibold money">
              {cents > 0 ? formatCentsCompact(cents) : ""}
            </span>
            <span
              className="w-full max-w-10 rounded-t-md bg-brand-gold"
              style={{ height: `${height}%` }}
              title={`${label}: ${formatCents(cents)}`}
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
