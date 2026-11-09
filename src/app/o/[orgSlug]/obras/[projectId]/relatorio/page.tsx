import type { Metadata } from "next";
import Link from "next/link";

import { BackLink } from "@/components/layout/back-link";
import { orgPath } from "@/components/layout/nav";
import { buttonVariants } from "@/components/ui/button";
import { APP_DOMAIN, APP_NAME } from "@/config/app";
import { dueState, summarizeOpen } from "@/features/payables/installments";
import { projectsCopy } from "@/features/projects/copy";
import { requireProject } from "@/features/projects/queries";
import { PrintButton } from "@/features/reports/components/print-button";
import {
  ReportFigure,
  ReportSection,
  ReportTable,
} from "@/features/reports/components/report-parts";
import { reportsCopy } from "@/features/reports/copy";
import {
  getProjectReport,
  REPORT_EXPENSE_LIMIT,
} from "@/features/reports/queries";
import {
  perSquareMeterCents,
  reportFileTitle,
  sharePercent,
} from "@/features/reports/summary";
import { stagesCopy } from "@/features/stages/copy";
import { summarizePlans } from "@/features/stages/queries";
import { formatDate, formatMonth, todayIn } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const copy = reportsCopy;

export const metadata: Metadata = { title: copy.title };

const LEVEL_TONE = {
  none: "text-muted-foreground",
  ok: "text-status-ok",
  warn: "text-status-warn",
  over: "text-status-danger",
} as const;

/**
 * Relatório da obra em página própria, pensado para "Salvar como PDF" na
 * impressão do navegador (sem dependência nova). A navegação do app some no
 * papel pelos estilos de impressão.
 */
export default async function ProjectReportPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/obras/[projectId]/relatorio">) {
  const { orgSlug, projectId } = await params;
  const { org, project } = await requireProject(orgSlug, projectId);
  const query = await searchParams;
  const withExpenses = query.gastos === "1";
  const report = await getProjectReport(project.id, { withExpenses });

  const today = todayIn(org.timezone);
  const base = orgPath(org.slug, "obras", project.id);
  const empty = copy.empty;

  const totalCents = report.constructionCents + report.landCents;
  const perM2 = perSquareMeterCents(
    report.constructionCents,
    project.built_area_m2,
  );
  const open = summarizeOpen(report.payables.open, today);
  const plan = summarizePlans(report.plans);
  const stagesSpent = report.plans.reduce((sum, p) => sum + p.spentCents, 0);
  const noStageCents = Math.max(0, report.constructionCents - stagesSpent);
  const location = [project.address, project.city, project.state]
    .filter(Boolean)
    .join(", ");

  const details: [string, string][] = [
    [copy.details.org, org.name],
    ...(location
      ? [[copy.details.location, location] as [string, string]]
      : []),
    ...(project.built_area_m2
      ? [
          [
            copy.details.area,
            copy.details.areaValue(
              project.built_area_m2.toLocaleString("pt-BR"),
            ),
          ] as [string, string],
        ]
      : []),
    ...(project.standard
      ? [
          [copy.details.standard, projectsCopy.standards[project.standard]] as [
            string,
            string,
          ],
        ]
      : []),
    ...(project.start_date
      ? [
          [copy.details.start, formatDate(project.start_date)] as [
            string,
            string,
          ],
        ]
      : []),
    [copy.details.status, projectsCopy.statuses[project.status]],
  ];

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 print:hidden">
        <BackLink href={base} label={copy.back} />
        <p className="max-w-prose text-sm text-muted-foreground">
          {copy.screenHint}
        </p>
        <div className="flex flex-wrap gap-3">
          <PrintButton
            label={copy.print}
            fileTitle={reportFileTitle(project.name, today)}
          />
          <Link
            href={
              withExpenses ? `${base}/relatorio` : `${base}/relatorio?gastos=1`
            }
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "rounded-xl",
            )}
          >
            {withExpenses ? copy.withoutExpenses : copy.withExpenses}
          </Link>
        </div>
      </div>

      <article className="rounded-2xl border bg-card p-4 text-card-foreground md:p-8 print:rounded-none print:border-0 print:p-0">
        <header className="border-b-4 border-brand-navy pb-4">
          <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {APP_NAME} · {copy.title}
          </p>
          <p className="mt-1 text-2xl heading md:text-3xl">{project.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.generatedOn(formatDate(today))}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <ReportSection title={copy.summary.title}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <ReportFigure
              label={copy.summary.construction}
              value={formatCents(report.constructionCents)}
              detail={copy.summary.expenseCount(report.expenseCount)}
              strong
            />
            <ReportFigure
              label={copy.summary.perSquareMeter}
              value={perM2 ? formatCents(perM2) : empty}
            />
            {report.landCents > 0 ? (
              <>
                <ReportFigure
                  label={copy.summary.land}
                  value={formatCents(report.landCents)}
                />
                <ReportFigure
                  label={copy.summary.total}
                  value={formatCents(totalCents)}
                />
              </>
            ) : null}
            <ReportFigure
              label={copy.summary.open}
              value={formatCents(open.totalCents)}
              detail={
                open.overdueCount > 0 ? (
                  <span className="font-semibold text-status-danger">
                    {copy.summary.overdue(
                      formatCents(open.overdueCents),
                      open.overdueCount,
                    )}
                  </span>
                ) : undefined
              }
            />
          </dl>
        </ReportSection>

        <ReportSection
          title={plan.hasBudget ? copy.stages.title : copy.stages.titleNoBudget}
        >
          {plan.hasBudget ? (
            <ReportTable
              columns={[
                { label: copy.stages.stage },
                { label: copy.stages.planned, numeric: true },
                { label: copy.stages.spent, numeric: true },
                { label: copy.stages.committed, numeric: true },
                { label: copy.stages.used, numeric: true },
                { label: copy.stages.progress, numeric: true },
                { label: copy.stages.status },
              ]}
              rows={report.plans.map((row) => ({
                key: row.id,
                cells: [
                  row.name,
                  row.budgetCents === null
                    ? empty
                    : formatCents(row.budgetCents),
                  formatCents(row.spentCents),
                  row.committedCents > 0
                    ? formatCents(row.committedCents)
                    : empty,
                  row.status.usedPercent === null
                    ? empty
                    : `${row.status.usedPercent}%`,
                  `${row.progressPercent}%`,
                  <span
                    key="status"
                    className={cn(
                      "font-semibold",
                      LEVEL_TONE[row.status.level],
                    )}
                  >
                    {stagesCopy.status[row.status.level]}
                    {row.status.aheadOfProgress ? (
                      <span className="block font-normal text-status-warn">
                        {stagesCopy.status.ahead}
                      </span>
                    ) : null}
                  </span>,
                ],
              }))}
              footer={[
                copy.stages.total,
                formatCents(plan.budgetCents),
                formatCents(stagesSpent),
                formatCents(
                  report.plans.reduce((sum, p) => sum + p.committedCents, 0),
                ),
                "",
                "",
                "",
              ]}
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {copy.stages.noBudgetNote}
              </p>
              <ReportTable
                columns={[
                  { label: copy.stages.stage },
                  { label: copy.stages.spent, numeric: true },
                  { label: copy.stages.committed, numeric: true },
                  { label: copy.stages.progress, numeric: true },
                ]}
                rows={report.plans.map((row) => ({
                  key: row.id,
                  cells: [
                    row.name,
                    row.spentCents > 0 ? formatCents(row.spentCents) : empty,
                    row.committedCents > 0
                      ? formatCents(row.committedCents)
                      : empty,
                    `${row.progressPercent}%`,
                  ],
                }))}
                footer={[
                  copy.stages.total,
                  formatCents(stagesSpent),
                  formatCents(
                    report.plans.reduce((sum, p) => sum + p.committedCents, 0),
                  ),
                  "",
                ]}
              />
            </>
          )}
          <div className="mt-3 flex flex-col gap-1 text-sm">
            {plan.hasBudget ? (
              <BudgetBalance
                budgetCents={plan.budgetCents}
                usedCents={plan.spentCents + plan.committedCents}
              />
            ) : null}
            {plan.hasBudget && plan.unbudgetedSpentCents > 0 ? (
              <p className="text-muted-foreground">
                {copy.stages.unbudgetedNote(
                  formatCents(plan.unbudgetedSpentCents),
                )}
              </p>
            ) : null}
            {noStageCents > 0 ? (
              <p className="text-muted-foreground">
                {copy.stages.noStageNote(formatCents(noStageCents))}
              </p>
            ) : null}
          </div>
        </ReportSection>

        {report.categories.length > 0 ? (
          <ReportSection title={copy.categories.title}>
            <ReportTable
              columns={[
                { label: copy.categories.category },
                { label: copy.categories.total, numeric: true },
                { label: copy.categories.share, numeric: true },
              ]}
              rows={report.categories.map((category) => ({
                key: category.category_id ?? category.category_name ?? "",
                cells: [
                  category.category_name ?? empty,
                  formatCents(category.total_cents ?? 0),
                  `${sharePercent(category.total_cents ?? 0, totalCents)}%`,
                ],
              }))}
              footer={[copy.stages.total, formatCents(totalCents), "100%"]}
            />
          </ReportSection>
        ) : null}

        {report.months.length > 0 ? (
          <ReportSection title={copy.months.title}>
            <ReportTable
              columns={[
                { label: copy.months.month },
                { label: copy.months.construction, numeric: true },
                ...(report.landCents > 0
                  ? [{ label: copy.months.land, numeric: true }]
                  : []),
              ]}
              rows={report.months.map((month) => ({
                key: month.month ?? "",
                cells: [
                  month.month ? formatMonth(month.month) : empty,
                  formatCents(month.construction_cents ?? 0),
                  ...(report.landCents > 0
                    ? [
                        (month.land_cents ?? 0) > 0
                          ? formatCents(month.land_cents ?? 0)
                          : empty,
                      ]
                    : []),
                ],
              }))}
              footer={[
                copy.stages.total,
                formatCents(report.constructionCents),
                ...(report.landCents > 0
                  ? [formatCents(report.landCents)]
                  : []),
              ]}
            />
          </ReportSection>
        ) : null}

        {report.payables.upcoming.length > 0 ? (
          <ReportSection title={copy.payables.title}>
            <ReportTable
              columns={[
                { label: copy.payables.due },
                { label: copy.payables.description },
                { label: copy.payables.installment },
                { label: copy.payables.amount, numeric: true },
              ]}
              rows={report.payables.upcoming.map((payable) => {
                const overdue = dueState(payable.due_date, today) === "overdue";
                return {
                  key: payable.id,
                  cells: [
                    <span
                      key="due"
                      className={cn(
                        overdue && "font-semibold text-status-danger",
                      )}
                    >
                      {formatDate(payable.due_date)}
                      {overdue ? ` (${copy.payables.overdue})` : ""}
                    </span>,
                    [payable.description, payable.supplier?.name]
                      .filter(Boolean)
                      .join(" · "),
                    payable.installment_total
                      ? `${payable.installment_number}/${payable.installment_total}`
                      : empty,
                    formatCents(payable.amount_cents),
                  ],
                };
              })}
              footer={[copy.stages.total, "", "", formatCents(open.totalCents)]}
            />
            {report.payables.open.length > report.payables.upcoming.length ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {copy.payables.truncated(
                  report.payables.upcoming.length,
                  report.payables.open.length,
                )}
              </p>
            ) : null}
          </ReportSection>
        ) : null}

        {withExpenses ? (
          <ReportSection title={copy.expenses.title}>
            {report.expensesTruncated ? (
              <p className="mb-3 text-sm text-muted-foreground">
                {copy.expenses.truncated(REPORT_EXPENSE_LIMIT)}
              </p>
            ) : null}
            <ReportTable
              columns={[
                { label: copy.expenses.date },
                { label: copy.expenses.description },
                { label: copy.expenses.stage },
                { label: copy.expenses.category },
                { label: copy.expenses.supplier },
                { label: copy.expenses.invoice },
                { label: copy.expenses.amount, numeric: true },
              ]}
              rows={report.expenses.map((expense) => ({
                key: expense.id,
                cells: [
                  formatDate(expense.spent_on),
                  expense.description || empty,
                  expense.stage?.name ?? empty,
                  expense.category?.name ?? empty,
                  expense.supplier?.name ?? empty,
                  expense.has_invoice ? copy.expenses.yes : copy.expenses.no,
                  formatCents(expense.amount_cents),
                ],
              }))}
              footer={[
                copy.expenses.total,
                "",
                "",
                "",
                "",
                "",
                formatCents(
                  report.expenses.reduce((sum, e) => sum + e.amount_cents, 0),
                ),
              ]}
            />
          </ReportSection>
        ) : null}

        <footer className="mt-10 border-t pt-3 text-xs text-muted-foreground">
          <p>{copy.footer}</p>
          <p className="mt-1">
            {APP_NAME} · {APP_DOMAIN}
          </p>
        </footer>
      </article>
    </>
  );
}

function BudgetBalance({
  budgetCents,
  usedCents,
}: {
  budgetCents: number;
  usedCents: number;
}) {
  const remaining = budgetCents - usedCents;
  return remaining >= 0 ? (
    <p className="font-semibold">
      {reportsCopy.stages.remaining}:{" "}
      <span className="money">{formatCents(remaining)}</span>
    </p>
  ) : (
    <p className="font-semibold text-status-danger">
      {reportsCopy.stages.overBy}:{" "}
      <span className="money">{formatCents(-remaining)}</span>
    </p>
  );
}
