import "server-only";

import {
  listExpenses,
  type ExpenseListItem,
} from "@/features/expenses/queries";
import type { ExpenseFilters } from "@/features/expenses/schemas";
import { listUpcomingPayables } from "@/features/payables/queries";
import { getStagePlans } from "@/features/stages/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Teto de gastos listados no relatório (o resto fica na planilha). Abaixo das
 * 1000 linhas que o Supabase devolve por consulta, para dar para saber se cortou.
 */
export const REPORT_EXPENSE_LIMIT = 500;
/** Teto de contas em aberto listadas no relatório. */
export const REPORT_PAYABLE_LIMIT = 200;

const NO_FILTERS: ExpenseFilters = {
  q: null,
  de: null,
  ate: null,
  etapa: null,
  categoria: null,
  fornecedor: null,
  nota: null,
};

/**
 * Tudo que o relatório da obra mostra. O RLS garante que só vem o que a
 * pessoa pode ver.
 */
export async function getProjectReport(
  projectId: string,
  { withExpenses }: { withExpenses: boolean },
) {
  const supabase = await createClient();
  const [summary, plans, categories, months, payables, expenses] =
    await Promise.all([
      supabase
        .from("v_project_summary")
        .select("construction_cents, land_cents, expense_count")
        .eq("project_id", projectId)
        .maybeSingle(),
      getStagePlans(projectId),
      supabase
        .from("v_project_category_summary")
        .select("category_id, category_name, total_cents")
        .eq("project_id", projectId)
        .order("total_cents", { ascending: false }),
      supabase
        .from("v_project_month_summary")
        .select("month, construction_cents, land_cents")
        .eq("project_id", projectId)
        .order("month"),
      listUpcomingPayables(projectId, REPORT_PAYABLE_LIMIT),
      withExpenses
        ? listExpenses(projectId, NO_FILTERS, REPORT_EXPENSE_LIMIT + 1)
        : Promise.resolve<ExpenseListItem[]>([]),
    ]);

  return {
    constructionCents: summary.data?.construction_cents ?? 0,
    landCents: summary.data?.land_cents ?? 0,
    expenseCount: summary.data?.expense_count ?? 0,
    plans,
    categories: categories.data ?? [],
    months: months.data ?? [],
    payables,
    // Do mais antigo para o mais recente, como se lê um relatório.
    expenses: expenses.slice(0, REPORT_EXPENSE_LIMIT).reverse(),
    expensesTruncated: expenses.length > REPORT_EXPENSE_LIMIT,
  };
}
