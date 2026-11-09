import type { NextRequest } from "next/server";

import { buildExpensesCsv, csvFileName } from "@/features/expenses/csv";
import { listExpenses } from "@/features/expenses/queries";
import { parseExpenseFilters } from "@/features/expenses/schemas";
import { getOrgBySlug } from "@/features/organizations/queries";
import { getProject } from "@/features/projects/queries";
import { todayIn } from "@/lib/dates";
import { isUuid } from "@/lib/forms";

/** O Supabase devolve no máximo 1000 linhas por consulta: busca em páginas. */
const PAGE_SIZE = 1000;
/** Teto de linhas por planilha; acima disso, use filtros por período. */
const EXPORT_LIMIT = 20_000;

/**
 * Planilha CSV dos gastos da obra, com os mesmos filtros da lista.
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

  const filters = parseExpenseFilters(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const expenses = [];
  for (let offset = 0; offset < EXPORT_LIMIT; offset += PAGE_SIZE) {
    const page = await listExpenses(project.id, filters, PAGE_SIZE, offset);
    expenses.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  const fileName = csvFileName(project.name, todayIn(org.timezone));

  return new Response(buildExpensesCsv(expenses), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
