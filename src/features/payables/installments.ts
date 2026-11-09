/**
 * Regras das contas a pagar que não dependem do banco: divisão em parcelas
 * mensais e situação do vencimento.
 */

import { addMonths, daysBetween } from "@/lib/dates";

export const MAX_INSTALLMENTS = 60;

/** Dias à frente que contam como "vence logo". */
export const DUE_SOON_DAYS = 7;

export type Installment = {
  number: number;
  dueDate: string;
  amountCents: number;
};

/**
 * Divide o valor total em `count` parcelas mensais a partir do primeiro
 * vencimento. Os centavos que sobram da divisão vão para a primeira parcela,
 * para a soma bater com o total.
 */
export function splitInstallments(
  totalCents: number,
  count: number,
  firstDueDate: string,
): Installment[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`Número de parcelas inválido: ${count}`);
  }
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    dueDate: addMonths(firstDueDate, index),
    amountCents: index === 0 ? base + remainder : base,
  }));
}

export type DueState = "overdue" | "today" | "soon" | "later";

/** Situação de uma conta em aberto em relação a hoje (fuso da organização). */
export function dueState(dueDate: string, today: string): DueState {
  const days = daysBetween(today, dueDate);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= DUE_SOON_DAYS) return "soon";
  return "later";
}

/** Totais das contas em aberto: atrasado, próximos 7 dias e tudo. */
export function summarizeOpen(
  payables: { amount_cents: number; due_date: string }[],
  today: string,
) {
  let overdueCents = 0;
  let soonCents = 0;
  let totalCents = 0;
  let overdueCount = 0;
  for (const payable of payables) {
    const state = dueState(payable.due_date, today);
    totalCents += payable.amount_cents;
    if (state === "overdue") {
      overdueCents += payable.amount_cents;
      overdueCount += 1;
    } else if (state !== "later") {
      soonCents += payable.amount_cents;
    }
  }
  return { overdueCents, overdueCount, soonCents, totalCents };
}
