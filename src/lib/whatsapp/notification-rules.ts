import type { BudgetLevel, StageStatus } from "@/features/stages/budget";
import { addDays } from "@/lib/dates";
import { formatCents } from "@/lib/money";

/**
 * Regras dos avisos que o bot manda por conta própria (alerta de orçamento e
 * resumo semanal). Puras, para testar sem banco nem Meta; quem consulta e
 * manda é notifications.ts.
 */

/** Nível já avisado de uma etapa (linha em budget_alerts). */
export type NotifiedLevel = "warn" | "over";

/**
 * O que fazer com uma etapa, comparando o nível de hoje com o último aviso:
 * avisa quando sobe (nada → 80%, nada ou 80% → 100%); guarda o nível de hoje;
 * abaixo de 80% (ou sem previsto), esquece o aviso, para um novo estouro
 * avisar de novo.
 */
export function alertDecision(
  current: BudgetLevel,
  notified: NotifiedLevel | null,
): { notify: boolean; store: NotifiedLevel | null } {
  if (current === "warn") return { notify: notified === null, store: "warn" };
  if (current === "over") return { notify: notified !== "over", store: "over" };
  return { notify: false, store: null };
}

/** Parâmetros do modelo alerta_orcamento. */
export function budgetAlertParams(input: {
  projectName: string;
  stageName: string;
  status: StageStatus;
  usedCents: number;
  budgetCents: number;
}): string[] {
  return [
    input.projectName,
    input.stageName,
    `${input.status.usedPercent ?? 100}%`,
    formatCents(input.usedCents),
    formatCents(input.budgetCents),
  ];
}

/** Segunda-feira? (data "AAAA-MM-DD", no fuso da conta). */
export function isMonday(isoDate: string): boolean {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay() === 1;
}

/** Semana anterior a `today` (segunda a domingo, se hoje é segunda). */
export function previousWeek(today: string): { from: string; to: string } {
  return { from: addDays(today, -7), to: addDays(today, -1) };
}

export type WeeklyNumbers = {
  projectName: string;
  weekSpentCents: number;
  weekCount: number;
  constructionCents: number;
  /** Contas abertas que vencem de hoje até daqui a 6 dias. */
  upcomingCents: number;
  /** Contas abertas já vencidas. */
  overdueCents: number;
};

/** Semana sem gasto e sem conta para olhar: não manda nada. */
export function hasWeeklyNews(numbers: WeeklyNumbers): boolean {
  return (
    numbers.weekCount > 0 ||
    numbers.upcomingCents > 0 ||
    numbers.overdueCents > 0
  );
}

/** Parâmetros do modelo resumo_semanal. */
export function weeklyReportParams(numbers: WeeklyNumbers): string[] {
  const bills = [
    numbers.overdueCents > 0
      ? `Contas atrasadas: ${formatCents(numbers.overdueCents)}.`
      : null,
    numbers.upcomingCents > 0
      ? `Contas nos próximos 7 dias: ${formatCents(numbers.upcomingCents)}.`
      : null,
  ].filter(Boolean);
  return [
    numbers.projectName,
    formatCents(numbers.weekSpentCents),
    numbers.weekCount === 1 ? "1 gasto" : `${numbers.weekCount} gastos`,
    formatCents(numbers.constructionCents),
    bills.length
      ? bills.join(" ")
      : "Nenhuma conta a vencer nos próximos 7 dias.",
  ];
}
