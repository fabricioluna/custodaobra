import "server-only";

import { createClient } from "@/lib/supabase/server";

const LIST_COLUMNS =
  "id, project_id, description, amount_cents, due_date, status, installment_number, installment_total, paid_expense_id, category:categories(id, code, name), stage:stages(id, name), supplier:suppliers(id, name), paid_expense:expenses!payables_paid_expense_id_project_id_fkey(id, amount_cents, spent_on)";

/** Quantas contas pagas mostrar na lista da obra (as mais recentes). */
export const PAID_LIST_LIMIT = 30;

/** Contas da obra: em aberto (por vencimento), pagas e canceladas recentes. */
export async function listProjectPayables(projectId: string) {
  const supabase = await createClient();
  const [open, paid, cancelled] = await Promise.all([
    supabase
      .from("payables")
      .select(LIST_COLUMNS)
      .eq("project_id", projectId)
      .eq("status", "open")
      .order("due_date")
      .order("installment_number", { nullsFirst: true })
      .order("id"),
    supabase
      .from("payables")
      .select(LIST_COLUMNS)
      .eq("project_id", projectId)
      .eq("status", "paid")
      .order("updated_at", { ascending: false })
      .limit(PAID_LIST_LIMIT),
    supabase
      .from("payables")
      .select(LIST_COLUMNS)
      .eq("project_id", projectId)
      .eq("status", "cancelled")
      .order("updated_at", { ascending: false })
      .limit(PAID_LIST_LIMIT),
  ]);
  return {
    open: open.data ?? [],
    paid: paid.data ?? [],
    cancelled: cancelled.data ?? [],
  };
}

export type PayableListItem = Awaited<
  ReturnType<typeof listProjectPayables>
>["open"][number];

/**
 * Contas em aberto de todas as obras ativas da organização (o RLS já deixa
 * só as obras que a pessoa vê), por vencimento.
 */
export async function listOrgOpenPayables(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payables")
    .select(`${LIST_COLUMNS}, project:projects!inner(id, name, archived_at)`)
    .eq("org_id", orgId)
    .eq("status", "open")
    .is("project.archived_at", null)
    .order("due_date")
    .order("id")
    .limit(500);
  return data ?? [];
}

/** Próximas contas em aberto da obra, para o painel. */
export async function listUpcomingPayables(projectId: string, limit = 5) {
  const supabase = await createClient();
  const [{ data: rows }, { data: all }] = await Promise.all([
    supabase
      .from("payables")
      .select(LIST_COLUMNS)
      .eq("project_id", projectId)
      .eq("status", "open")
      .order("due_date")
      .order("id")
      .limit(limit),
    supabase
      .from("payables")
      .select("amount_cents, due_date")
      .eq("project_id", projectId)
      .eq("status", "open"),
  ]);
  return { upcoming: rows ?? [], open: all ?? [] };
}

/** Uma conta, com as outras parcelas do mesmo grupo. */
export async function getPayable(projectId: string, payableId: string) {
  const supabase = await createClient();
  const { data: payable } = await supabase
    .from("payables")
    .select(
      `${LIST_COLUMNS}, category_id, stage_id, installment_group_id, created_at`,
    )
    .eq("project_id", projectId)
    .eq("id", payableId)
    .maybeSingle();
  if (!payable) return null;

  let siblings: PayableListItem[] = [];
  if (payable.installment_group_id) {
    const { data } = await supabase
      .from("payables")
      .select(LIST_COLUMNS)
      .eq("project_id", projectId)
      .eq("installment_group_id", payable.installment_group_id)
      .neq("id", payable.id)
      .order("installment_number");
    siblings = data ?? [];
  }
  return { ...payable, siblings };
}
