/**
 * Datas sem hora (spent_on, due_date) são strings "AAAA-MM-DD". "Hoje" é
 * sempre no fuso da organização, não no do servidor.
 */

import { DEFAULT_TIMEZONE } from "@/config/app";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data de hoje ("AAAA-MM-DD") no fuso informado. */
export function todayIn(
  timezone: string = DEFAULT_TIMEZONE,
  now: Date = new Date(),
): string {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Soma dias a uma data "AAAA-MM-DD". */
export function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  if (!date) throw new Error(`Data inválida: ${isoDate}`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "AAAA-MM-DD" válido (inclusive dia que existe no calendário). */
export function isIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

const dayMonthYear = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const monthYear = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  month: "short",
  year: "numeric",
});

/** "2026-11-08" → "08/11/2026". */
export function formatDate(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return date ? dayMonthYear.format(date) : isoDate;
}

/** "2026-11-01" → "nov. de 2026" → "nov/2026". */
export function formatMonth(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  if (!date) return isoDate;
  return monthYear.format(date).replace(".", "").replace(" de ", "/");
}

/**
 * Data relativa curta para listas: "hoje", "ontem" ou "08/11/2026".
 * `today` é a data de hoje no fuso da organização.
 */
export function formatRelativeDate(isoDate: string, today: string): string {
  if (isoDate === today) return "hoje";
  if (isoDate === addDays(today, -1)) return "ontem";
  return formatDate(isoDate);
}
