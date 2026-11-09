import "server-only";

import { createClient } from "@/lib/supabase/server";

import { stageStatus, type StageStatus } from "./budget";

export type StagePlanRow = {
  id: string;
  name: string;
  budgetCents: number | null;
  spentCents: number;
  committedCents: number;
  progressPercent: number;
  expenseCount: number;
  status: StageStatus;
};

/** Etapas da obra com previsto, realizado, a pagar, progresso e alerta. */
export async function getStagePlans(
  projectId: string,
): Promise<StagePlanRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_stage_summary")
    .select(
      "stage_id, name, budget_cents, spent_cents, committed_cents, progress_percent, expense_count",
    )
    .eq("project_id", projectId)
    .order("sort_order");
  return (data ?? []).map((row) => {
    const plan = {
      budgetCents: row.budget_cents,
      spentCents: row.spent_cents ?? 0,
      committedCents: row.committed_cents ?? 0,
      progressPercent: row.progress_percent ?? 0,
    };
    return {
      id: row.stage_id ?? "",
      name: row.name ?? "",
      ...plan,
      expenseCount: row.expense_count ?? 0,
      status: stageStatus(plan),
    };
  });
}

/** Totais do previsto x realizado (só etapas com previsto entram no %). */
export function summarizePlans(plans: StagePlanRow[]) {
  const budgeted = plans.filter((plan) => plan.budgetCents !== null);
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  return {
    hasBudget: budgeted.length > 0,
    budgetCents: sum(budgeted.map((plan) => plan.budgetCents ?? 0)),
    spentCents: sum(budgeted.map((plan) => plan.spentCents)),
    committedCents: sum(budgeted.map((plan) => plan.committedCents)),
    unbudgetedSpentCents: sum(
      plans
        .filter((plan) => plan.budgetCents === null)
        .map((plan) => plan.spentCents),
    ),
    alerts: plans.filter(
      (plan) =>
        plan.status.level === "warn" ||
        plan.status.level === "over" ||
        plan.status.aheadOfProgress,
    ),
  };
}

/** Dados do formulário de orçamento (inclui o percentual de referência). */
export async function getBudgetFormData(projectId: string) {
  const supabase = await createClient();
  const [{ data: stages }, { data: project }] = await Promise.all([
    supabase
      .from("stages")
      .select("id, name, budget_cents, default_percent")
      .eq("project_id", projectId)
      .order("sort_order"),
    supabase
      .from("projects")
      .select("built_area_m2, cost_per_m2_cents")
      .eq("id", projectId)
      .maybeSingle(),
  ]);
  return {
    stages: (stages ?? []).map((stage) => ({
      id: stage.id,
      name: stage.name,
      budgetCents: stage.budget_cents,
      defaultPercent:
        stage.default_percent === null ? null : Number(stage.default_percent),
    })),
    areaM2: project?.built_area_m2 ?? null,
    costPerM2Cents: project?.cost_per_m2_cents ?? null,
  };
}
