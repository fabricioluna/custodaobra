import { Download, ReceiptText } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { orgPath } from "@/components/layout/nav";
import { buttonVariants } from "@/components/ui/button";
import { ExpenseFilters } from "@/features/expenses/components/expense-filters";
import { ExpenseList } from "@/features/expenses/components/expense-list";
import { expensesCopy } from "@/features/expenses/copy";
import {
  EXPENSE_LIST_LIMIT,
  getExpenseFormOptions,
  listExpenses,
} from "@/features/expenses/queries";
import {
  filtersToSearchParams,
  hasActiveFilters,
  parseExpenseFilters,
} from "@/features/expenses/schemas";
import { requireProject } from "@/features/projects/queries";
import { todayIn } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const copy = expensesCopy.list;

export const metadata: Metadata = { title: copy.title };

export default async function ProjectExpensesPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/obras/[projectId]/lancamentos">) {
  const { orgSlug, projectId } = await params;
  const { org, project } = await requireProject(orgSlug, projectId);
  const filters = parseExpenseFilters(await searchParams);

  const [expenses, options] = await Promise.all([
    listExpenses(project.id, filters),
    getExpenseFormOptions(org.id, project.id),
  ]);

  const base = orgPath(org.slug, "obras", project.id, "lancamentos");
  const total = expenses.reduce((sum, e) => sum + e.amount_cents, 0);
  const filtered = hasActiveFilters(filters);

  return (
    <>
      <ExpenseFilters action={base} filters={filters} options={options} />

      {expenses.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={filtered ? copy.noResultsTitle : copy.emptyTitle}
          description={
            filtered ? copy.noResultsDescription : copy.emptyDescription
          }
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-muted-foreground">
              {copy.total(expenses.length)}
            </p>
            <p className="text-2xl font-extrabold money">
              {formatCents(total)}
            </p>
          </div>
          <ExpenseList
            expenses={expenses}
            hrefFor={(id) => `${base}/${id}`}
            today={todayIn(org.timezone)}
          />
          {expenses.length >= EXPENSE_LIST_LIMIT ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {copy.truncated(EXPENSE_LIST_LIMIT)}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={`${base}/exportar${filtersToSearchParams(filters)}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "rounded-xl",
              )}
            >
              <Download aria-hidden />
              {copy.export}
            </a>
            <a
              href={`${base}/exportar${filtersToSearchParams(filters, { formato: "csv" })}`}
              className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4"
            >
              {copy.exportCsv}
            </a>
          </div>
        </>
      )}
    </>
  );
}
