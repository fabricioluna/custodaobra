import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ExpenseFilters,
  GroupBy,
  PayableStatus,
  QueryCall,
} from "@/lib/ai/query-tools";
import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

/**
 * Funções de consulta predefinidas das perguntas livres (CLAUDE.md, seção
 * 6). A IA escolhe qual e com quais filtros (src/lib/ai/query-tools.ts); o
 * código consulta e devolve os números, que question-format.ts transforma em
 * texto.
 *
 * Rodam com service_role (webhook, sem sessão): toda consulta filtra por
 * org_id e project_id à mão. Gastos: só confirmados e não excluídos, como em
 * todo total do app.
 */

export type QueryProject = { id: string; orgId: string };

export type ExpenseRow = {
  amountCents: number;
  description: string;
  spentOn: string;
  stageName: string | null;
  categoryCode: string;
  supplierName: string | null;
};

export type QueryAnswer =
  | {
      name: "total_spent";
      filters: ExpenseFilters;
      totalCents: number;
      /** Parte do total que é terreno (fica fora do custo da construção). */
      landCents: number;
      count: number;
    }
  | {
      name: "spending_breakdown";
      filters: ExpenseFilters;
      groupBy: GroupBy;
      groups: { label: string | null; cents: number }[];
      totalCents: number;
      count: number;
    }
  | {
      name: "recent_expenses";
      filters: ExpenseFilters;
      items: ExpenseRow[];
    }
  | {
      name: "budget_status";
      stageId: string | null;
      stages: {
        id: string;
        name: string;
        budgetCents: number | null;
        spentCents: number;
        committedCents: number;
        progressPercent: number;
      }[];
    }
  | {
      name: "payables";
      status: PayableStatus;
      from: string | null;
      to: string | null;
      items: {
        description: string;
        amountCents: number;
        dueDate: string;
        supplierName: string | null;
      }[];
      totalCents: number;
      count: number;
    };

/** O PostgREST devolve até 1000 linhas por vez: as contas leem em páginas. */
const PAGE_SIZE = 1000;
/** Teto de segurança (20 mil gastos numa obra). */
const MAX_PAGES = 20;
/** Contas listadas na resposta (o total soma todas). */
const PAYABLES_SHOWN = 5;

const EXPENSE_COLUMNS =
  "amount_cents, description, spent_on, stages(name), categories(code), suppliers(name)" as const;

/** Escapa os curingas do ILIKE para buscar o texto como digitado. */
const likePattern = (text: string) =>
  `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function runQuery(
  admin: Admin,
  project: QueryProject,
  call: QueryCall,
  today: string,
): Promise<QueryAnswer> {
  switch (call.name) {
    case "total_spent": {
      const [row] = await expenseTotals(admin, project, call.filters, null);
      return {
        name: "total_spent",
        filters: call.filters,
        totalCents: row?.cents ?? 0,
        landCents: row?.landCents ?? 0,
        count: row?.count ?? 0,
      };
    }
    case "spending_breakdown": {
      const rows = await expenseTotals(
        admin,
        project,
        call.filters,
        call.groupBy,
      );
      return {
        name: "spending_breakdown",
        filters: call.filters,
        groupBy: call.groupBy,
        groups: sortGroups(
          rows.map(({ label, cents }) => ({ label, cents })),
          call.groupBy,
        ),
        totalCents: rows.reduce((total, row) => total + row.cents, 0),
        count: rows.reduce((total, row) => total + row.count, 0),
      };
    }
    case "recent_expenses": {
      const items = await recentExpenses(
        admin,
        project,
        call.filters,
        call.limit,
      );
      return { name: "recent_expenses", filters: call.filters, items };
    }
    case "budget_status":
      return budgetStatus(admin, project, call.stageId);
    case "payables":
      return payables(admin, project, call, today);
  }
}

const sum = (rows: { amountCents: number }[]) =>
  rows.reduce((total, row) => total + row.amountCents, 0);

type Group = { label: string | null; cents: number };

/**
 * Ordem dos grupos: por mês, a do calendário; nos outros, do maior para o
 * menor. Sem etapa/fornecedor: label nulo.
 */
export function sortGroups(groups: Group[], groupBy: GroupBy): Group[] {
  return groupBy === "month"
    ? groups.sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""))
    : groups.sort((a, b) => b.cents - a.cents);
}

/**
 * Categoria e fornecedor viram listas de ids antes (consulta simples, sem
 * junção filtrada). null = sem esse filtro; lista vazia = o filtro não acha
 * nada (nenhum gasto, em vez de ignorar o filtro).
 */
async function filterIds(
  admin: Admin,
  project: QueryProject,
  filters: ExpenseFilters,
) {
  const [categoryIds, supplierIds] = await Promise.all([
    filters.categoryCode
      ? idsOf(
          admin
            .from("categories")
            .select("id")
            // Categorias do sistema (org_id nulo) ou da própria conta.
            .or(`org_id.is.null,org_id.eq.${project.orgId}`)
            .eq("code", filters.categoryCode),
        )
      : null,
    filters.supplier
      ? idsOf(
          admin
            .from("suppliers")
            .select("id")
            .eq("org_id", project.orgId)
            .ilike("name", likePattern(filters.supplier)),
        )
      : null,
  ]);
  const empty = categoryIds?.length === 0 || supplierIds?.length === 0;
  return { categoryIds, supplierIds, empty };
}

/**
 * Somas dos gastos confirmados da obra com os filtros pedidos, feitas no
 * banco (expense_totals): uma linha por grupo, ou uma só sem grupo.
 */
async function expenseTotals(
  admin: Admin,
  project: QueryProject,
  filters: ExpenseFilters,
  groupBy: GroupBy | null,
): Promise<
  { label: string | null; cents: number; landCents: number; count: number }[]
> {
  const { categoryIds, supplierIds, empty } = await filterIds(
    admin,
    project,
    filters,
  );
  if (empty) return [];
  const { data, error } = await admin.rpc("expense_totals", {
    p_org_id: project.orgId,
    p_project_id: project.id,
    p_group_by: groupBy ?? undefined,
    p_from: filters.from ?? undefined,
    p_to: filters.to ?? undefined,
    p_stage_id: filters.stageId ?? undefined,
    p_category_ids: categoryIds ?? undefined,
    p_supplier_ids: supplierIds ?? undefined,
    p_payment_method: filters.paymentMethod ?? undefined,
    p_search: filters.search ? likePattern(filters.search) : undefined,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    // Os tipos gerados não marcam colunas de função como anuláveis.
    label: row.label as string | null,
    cents: Number(row.cents),
    landCents: Number(row.land_cents),
    count: Number(row.expense_count),
  }));
}

/** Os gastos mais recentes da obra com os filtros pedidos. */
async function recentExpenses(
  admin: Admin,
  project: QueryProject,
  filters: ExpenseFilters,
  limit: number,
): Promise<ExpenseRow[]> {
  const { categoryIds, supplierIds, empty } = await filterIds(
    admin,
    project,
    filters,
  );
  if (empty) return [];
  let query = admin
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .eq("org_id", project.orgId)
    .eq("project_id", project.id)
    .eq("status", "confirmed")
    .is("deleted_at", null);
  if (filters.from) query = query.gte("spent_on", filters.from);
  if (filters.to) query = query.lte("spent_on", filters.to);
  if (filters.stageId) query = query.eq("stage_id", filters.stageId);
  if (categoryIds) query = query.in("category_id", categoryIds);
  if (supplierIds) query = query.in("supplier_id", supplierIds);
  if (filters.paymentMethod) {
    query = query.eq("payment_method", filters.paymentMethod);
  }
  if (filters.search) {
    query = query.ilike("description", likePattern(filters.search));
  }
  const { data, error } = await query
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id")
    .limit(limit);
  if (error) throw error;
  return data.map((row) => ({
    amountCents: row.amount_cents,
    description: row.description,
    spentOn: row.spent_on,
    stageName: row.stages?.name ?? null,
    categoryCode: row.categories?.code ?? "outros",
    supplierName: row.suppliers?.name ?? null,
  }));
}

async function idsOf(
  query: PromiseLike<{ data: { id: string }[] | null; error: unknown }>,
): Promise<string[]> {
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

async function budgetStatus(
  admin: Admin,
  project: QueryProject,
  stageId: string | null,
): Promise<QueryAnswer> {
  let query = admin
    .from("v_stage_summary")
    .select(
      "stage_id, name, sort_order, budget_cents, spent_cents, committed_cents, progress_percent",
    )
    .eq("org_id", project.orgId)
    .eq("project_id", project.id);
  if (stageId) query = query.eq("stage_id", stageId);
  const { data, error } = await query.order("sort_order");
  if (error) throw error;
  return {
    name: "budget_status",
    stageId,
    stages: data.map((row) => ({
      id: row.stage_id ?? "",
      name: row.name ?? "",
      budgetCents: row.budget_cents,
      spentCents: row.spent_cents ?? 0,
      committedCents: row.committed_cents ?? 0,
      progressPercent: row.progress_percent ?? 0,
    })),
  };
}

async function payables(
  admin: Admin,
  project: QueryProject,
  call: Extract<QueryCall, { name: "payables" }>,
  today: string,
): Promise<QueryAnswer> {
  const page = async (offset: number) => {
    let query = admin
      .from("payables")
      .select("description, amount_cents, due_date, suppliers(name)")
      .eq("org_id", project.orgId)
      .eq("project_id", project.id)
      .eq("status", call.status === "paid" ? "paid" : "open");
    if (call.status === "overdue") query = query.lt("due_date", today);
    if (call.status === "upcoming") query = query.gte("due_date", today);
    if (call.from) query = query.gte("due_date", call.from);
    if (call.to) query = query.lte("due_date", call.to);
    // Pagas: as mais recentes primeiro; em aberto: as que vencem antes.
    const { data, error } = await query
      .order("due_date", { ascending: call.status !== "paid" })
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    return data.map((row) => ({
      description: row.description,
      amountCents: row.amount_cents,
      dueDate: row.due_date,
      supplierName: row.suppliers?.name ?? null,
    }));
  };

  // Todas as páginas: o total e a quantidade da resposta batem.
  const items: Awaited<ReturnType<typeof page>> = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const batch = await page(i * PAGE_SIZE);
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return {
    name: "payables",
    status: call.status,
    from: call.from,
    to: call.to,
    items: items.slice(0, PAYABLES_SHOWN),
    totalCents: sum(items),
    count: items.length,
  };
}
