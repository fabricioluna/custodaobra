/**
 * Previsto x realizado por etapa (CLAUDE.md, seção 5).
 * - "realizado" = gastos confirmados; "comprometido" = contas a pagar abertas.
 * - Amarelo quando realizado + comprometido passa de 80% do previsto;
 *   vermelho acima de 100%.
 * - Alerta extra quando o percentual gasto supera o progresso informado em
 *   mais de 20 pontos.
 */

export type BudgetLevel = "none" | "ok" | "warn" | "over";

export type StagePlan = {
  budgetCents: number | null;
  spentCents: number;
  committedCents: number;
  progressPercent: number;
};

export type StageStatus = {
  level: BudgetLevel;
  /** (realizado + comprometido) / previsto, em % inteiro; nulo sem previsto. */
  usedPercent: number | null;
  /** realizado / previsto, em % inteiro; nulo sem previsto. */
  spentPercent: number | null;
  /** Gasto bem à frente do progresso da etapa. */
  aheadOfProgress: boolean;
};

export const WARN_RATIO = 0.8;
export const PROGRESS_GAP_POINTS = 20;

export function stageStatus(plan: StagePlan): StageStatus {
  const used = plan.spentCents + plan.committedCents;
  const budget = plan.budgetCents;

  if (budget === null) {
    return {
      level: "none",
      usedPercent: null,
      spentPercent: null,
      aheadOfProgress: false,
    };
  }
  if (budget === 0) {
    // Previsto zero: qualquer gasto já estoura.
    return {
      level: used > 0 ? "over" : "ok",
      usedPercent: null,
      spentPercent: null,
      aheadOfProgress: false,
    };
  }

  const level: BudgetLevel =
    used > budget ? "over" : used > budget * WARN_RATIO ? "warn" : "ok";
  const spentRatio = (plan.spentCents / budget) * 100;
  return {
    level,
    usedPercent: Math.round((used / budget) * 100),
    spentPercent: Math.round(spentRatio),
    aheadOfProgress: spentRatio - plan.progressPercent > PROGRESS_GAP_POINTS,
  };
}

/** Pior nível entre as etapas (para o resumo da obra). */
export function worstLevel(levels: BudgetLevel[]): BudgetLevel {
  const order: BudgetLevel[] = ["none", "ok", "warn", "over"];
  return levels.reduce<BudgetLevel>(
    (worst, level) =>
      order.indexOf(level) > order.indexOf(worst) ? level : worst,
    "none",
  );
}

/** Área × custo por m², em centavos. Área com até 2 casas decimais. */
export function estimateTotalCents(
  areaM2: number,
  costPerM2Cents: number,
): number {
  return Math.round(areaM2 * costPerM2Cents);
}

/**
 * Divide o total da estimativa entre as etapas, proporcional ao percentual de
 * referência de cada uma. Os percentuais são reescalados para somar 100% entre
 * as etapas que existem (se a pessoa removeu alguma, o total não se perde).
 * Valores redondos em reais; a sobra do arredondamento vai para as maiores
 * frações, para a soma bater com o total (arredondado em reais).
 * Etapas sem percentual (criadas pela pessoa) ficam de fora: `null`.
 */
export function distributeEstimate(
  totalCents: number,
  stages: { id: string; defaultPercent: number | null }[],
): Map<string, number | null> {
  const result = new Map<string, number | null>();
  const weighted = stages.filter(
    (stage) => stage.defaultPercent !== null && stage.defaultPercent > 0,
  );
  for (const stage of stages) result.set(stage.id, null);
  if (weighted.length === 0 || totalCents <= 0) return result;

  const totalReais = Math.round(totalCents / 100);
  const weightSum = weighted.reduce((sum, s) => sum + s.defaultPercent!, 0);
  const shares = weighted.map((stage) => {
    const exact = (totalReais * stage.defaultPercent!) / weightSum;
    return { id: stage.id, floor: Math.floor(exact), frac: exact % 1 };
  });

  let remainder = totalReais - shares.reduce((sum, s) => sum + s.floor, 0);
  const byFraction = [...shares].sort((a, b) => b.frac - a.frac);
  for (const share of byFraction) {
    if (remainder <= 0) break;
    share.floor += 1;
    remainder -= 1;
  }
  for (const share of shares) result.set(share.id, share.floor * 100);
  return result;
}
