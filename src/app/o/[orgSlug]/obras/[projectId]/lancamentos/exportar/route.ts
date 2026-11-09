import type { NextRequest } from "next/server";

import { buildExpensesCsv, csvFileName } from "@/features/expenses/csv";
import { listExpenses } from "@/features/expenses/queries";
import { parseExpenseFilters } from "@/features/expenses/schemas";
import { buildExpensesXlsx } from "@/features/expenses/xlsx";
import { getOrgBySlug } from "@/features/organizations/queries";
import { getProject } from "@/features/projects/queries";
import { todayIn } from "@/lib/dates";
import { isUuid } from "@/lib/forms";

/** O Supabase devolve no máximo 1000 linhas por consulta: busca em páginas. */
const PAGE_SIZE = 1000;
/** Teto de linhas por planilha; acima disso, use filtros por período. */
const EXPORT_LIMIT = 20_000;

/**
 * Planilha dos gastos da obra (XLSX, ou CSV com `?formato=csv`), com os
 * mesmos filtros da lista.
 * O RLS garante que só sai o que a pessoa pode ver.
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: RouteContext<"/o/[orgSlug]/obras/[projectId]/lancamentos/exportar">,
) {
  const { orgSlug, projectId } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org || !isUuid(projectId)) {
    return new Response("Não encontrado", { status: 404 });
  }
  const project = await getProject(org.id, projectId);
  if (!project) return new Response("Não encontrado", { status: 404 });

  const { formato, ...query } = Object.fromEntries(
    request.nextUrl.searchParams,
  );
  const filters = parseExpenseFilters(query);
  const expenses = [];
  for (let offset = 0; offset < EXPORT_LIMIT; offset += PAGE_SIZE) {
    const page = await listExpenses(project.id, filters, PAGE_SIZE, offset);
    expenses.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  const today = todayIn(org.timezone);
  const headers = { "Cache-Control": "private, no-store" };

  if (formato === "csv") {
    const fileName = csvFileName(project.name, today, "csv");
    return new Response(buildExpensesCsv(expenses), {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  }

  const fileName = csvFileName(project.name, today, "xlsx");
  const xlsx = await buildExpensesXlsx(expenses, project.name);
  return new Response(new Uint8Array(xlsx), {
    headers: {
      ...headers,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
