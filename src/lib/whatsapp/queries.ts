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

/** O PostgREST devolve até 1000 linhas por vez: as somas leem em páginas. */
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
      const rows = await fetchExpenses(admin, project, call.filters);
      const land = rows.filter((row) => row.categoryCode === "terreno");
      return {
        name: "total_spent",
        filters: call.filters,
        totalCents: sum(rows),
        landCents: sum(land),
        count: rows.length,
      };
    }
    case "spending_breakdown": {
      const rows = await fetchExpenses(admin, project, call.filters);
      return {
        name: "spending_breakdown",
        filters: call.filters,
        groupBy: call.groupBy,
        groups: groupRows(rows, call.groupBy),
        totalCents: sum(rows),
        count: rows.length,
      };
    }
    case "recent_expenses": {
      const items = await fetchExpenses(admin, project, call.filters, {
        limit: call.limit,
      });
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

/** Soma por grupo, do maior para o menor. Sem etapa/fornecedor: label nulo. */
export function groupRows(
  rows: ExpenseRow[],
  groupBy: GroupBy,
): { label: string | null; cents: number }[] {
  const totals = new Map<string | null, number>();
  for (const row of rows) {
    const label =
      groupBy === "stage"
        ? row.stageName
        : groupBy === "category"
          ? row.categoryCode
          : groupBy === "supplier"
            ? row.supplierName
            : row.spentOn.slice(0, 7);
    totals.set(label, (totals.get(label) ?? 0) + row.amountCents);
  }
  const groups = [...totals].map(([label, cents]) => ({ label, cents }));
  // Por mês, a ordem é a do calendário; nos outros, do maior para o menor.
  return groupBy === "month"
    ? groups.sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""))
    : groups.sort((a, b) => b.cents - a.cents);
}

/**
 * Gastos confirmados da obra com os filtros pedidos. Categoria e fornecedor
 * viram listas de ids antes (consulta simples, sem junção filtrada).
 */
async function fetchExpenses(
  admin: Admin,
  project: QueryProject,
  filters: ExpenseFilters,
  options: { limit?: number } = {},
): Promise<ExpenseRow[]> {
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
  // Filtro que não acha nada: nenhum gasto (não ignora o filtro).
  if (categoryIds?.length === 0 || supplierIds?.length === 0) return [];

  const page = async (offset: number, size: number) => {
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
      .range(offset, offset + size - 1);
    if (error) throw error;
    return data.map((row) => ({
      amountCents: row.amount_cents,
      description: row.description,
      spentOn: row.spent_on,
      stageName: row.stages?.name ?? null,
      categoryCode: row.categories?.code ?? "outros",
      supplierName: row.suppliers?.name ?? null,
    }));
  };

  if (options.limit) return page(0, options.limit);

  const rows: ExpenseRow[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const batch = await page(i * PAGE_SIZE, PAGE_SIZE);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
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
