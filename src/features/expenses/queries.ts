import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import type { ExpenseFilters } from "./schemas";

/** Máximo de linhas na lista (o resto aparece com filtros). */
export const EXPENSE_LIST_LIMIT = 300;

/** Etapas, categorias e fornecedores para o formulário de lançamento. */
export const getExpenseFormOptions = cache(
  async (orgId: string, projectId: string) => {
    const supabase = await createClient();
    const [stages, categories, suppliers] = await Promise.all([
      supabase
        .from("stages")
        .select("id, name")
        .eq("project_id", projectId)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("categories")
        .select("id, code, name")
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .order("sort_order"),
      supabase
        .from("suppliers")
        .select("id, name")
        .eq("org_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);
    return {
      stages: stages.data ?? [],
      categories: categories.data ?? [],
      suppliers: suppliers.data ?? [],
    };
  },
);

const LIST_COLUMNS =
  "id, description, amount_cents, spent_on, has_invoice, invoice_number, payment_method, quantity, unit, unit_price_cents, stage_id, created_at, category:categories(id, code, name), stage:stages(id, name), supplier:suppliers(id, name), attachments(id)";

/** Lançamentos confirmados da obra, com filtros, mais recentes primeiro. */
export async function listExpenses(
  projectId: string,
  filters: ExpenseFilters,
  limit = EXPENSE_LIST_LIMIT,
  offset = 0,
) {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select(LIST_COLUMNS)
    .eq("project_id", projectId)
    .eq("status", "confirmed")
    .is("deleted_at", null);

  if (filters.de) query = query.gte("spent_on", filters.de);
  if (filters.ate) query = query.lte("spent_on", filters.ate);
  if (filters.etapa === "sem") query = query.is("stage_id", null);
  else if (filters.etapa) query = query.eq("stage_id", filters.etapa);
  if (filters.categoria) query = query.eq("category_id", filters.categoria);
  if (filters.fornecedor) query = query.eq("supplier_id", filters.fornecedor);
  if (filters.nota) query = query.eq("has_invoice", filters.nota === "com");
  if (filters.q) {
    // Escapa os curingas do ILIKE para buscar o texto como digitado.
    const term = filters.q.replace(/[\\%_]/g, (c) => `\\${c}`);
    query = query.ilike("description", `%${term}%`);
  }

  const { data } = await query
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id")
    .range(offset, offset + limit - 1);
  return data ?? [];
}

export type ExpenseListItem = Awaited<ReturnType<typeof listExpenses>>[number];

/** Um lançamento (não excluído) com comprovantes. */
export async function getExpense(projectId: string, expenseId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select(
      "id, org_id, project_id, description, amount_cents, spent_on, has_invoice, invoice_number, payment_method, quantity, unit, unit_price_cents, stage_id, category_id, status, source, created_at, category:categories(id, code, name), stage:stages(id, name), supplier:suppliers(id, name), attachments(id, storage_path, mime_type, size_bytes, created_at)",
    )
    .eq("project_id", projectId)
    .eq("id", expenseId)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

/** URL temporária (5 minutos) para abrir um comprovante do bucket privado. */
export async function getReceiptUrl(storagePath: string) {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("comprovantes")
    .createSignedUrl(storagePath, 300);
  return data?.signedUrl ?? null;
}

/** Dados do painel da obra: totais, etapas, categorias, meses e pendências. */
export async function getProjectDashboard(projectId: string) {
  const supabase = await createClient();
  const [summary, stages, categories, months, unclassified, recent] =
    await Promise.all([
      supabase
        .from("v_project_summary")
        .select(
          "construction_cents, land_cents, unclassified_count, expense_count, last_spent_on",
        )
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("v_stage_summary")
        .select(
          "stage_id, name, sort_order, budget_cents, spent_cents, expense_count, progress_percent",
        )
        .eq("project_id", projectId)
        .order("sort_order"),
      supabase
        .from("v_project_category_summary")
        .select("category_id, category_code, category_name, total_cents")
        .eq("project_id", projectId)
        .order("total_cents", { ascending: false }),
      supabase
        .from("v_project_month_summary")
        .select("month, construction_cents, land_cents")
        .eq("project_id", projectId)
        .order("month", { ascending: false })
        .limit(12),
      listExpenses(
        projectId,
        {
          q: null,
          de: null,
          ate: null,
          etapa: "sem",
          categoria: null,
          fornecedor: null,
          nota: null,
        },
        50,
      ),
      listExpenses(
        projectId,
        {
          q: null,
          de: null,
          ate: null,
          etapa: null,
          categoria: null,
          fornecedor: null,
          nota: null,
        },
        5,
      ),
    ]);

  return {
    summary: summary.data ?? {
      construction_cents: 0,
      land_cents: 0,
      unclassified_count: 0,
      expense_count: 0,
      last_spent_on: null,
    },
    stages: stages.data ?? [],
    categories: categories.data ?? [],
    // Do mais antigo para o mais recente, para ler da esquerda para a direita.
    months: (months.data ?? []).reverse(),
    // "Para classificar" não inclui terreno, que não tem etapa mesmo.
    unclassified: unclassified.filter((e) => e.category?.code !== "terreno"),
    recent,
  };
}
