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

/**
 * Soma meses a uma data "AAAA-MM-DD". Se o dia não existe no mês de destino,
 * usa o último dia dele (31/01 + 1 mês = 28/02 ou 29/02).
 */
export function addMonths(isoDate: string, months: number): string {
  const date = parseIsoDate(isoDate);
  if (!date) throw new Error(`Data inválida: ${isoDate}`);
  const day = date.getUTCDate();
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Dias de `from` até `to` (negativo se `to` vem antes). */
export function daysBetween(from: string, to: string): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  if (!a || !b) throw new Error(`Data inválida: ${from} / ${to}`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Instante em que o dia "AAAA-MM-DD" começa no fuso informado (meia-noite
 * local), como ISO em UTC. Ex.: "2026-12-01" em America/Recife (UTC-3) →
 * "2026-12-01T03:00:00.000Z".
 */
export function startOfDayIn(
  isoDate: string,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const date = parseIsoDate(isoDate);
  if (!date) throw new Error(`Data inválida: ${isoDate}`);
  const midnightUtc = date.getTime();
  // O deslocamento é medido duas vezes: na meia-noite UTC e de novo no
  // instante achado, para acertar os dias em que o horário de verão muda.
  const first = midnightUtc - offsetAt(midnightUtc, timezone);
  return new Date(midnightUtc - offsetAt(first, timezone)).toISOString();
}

/** Quanto o relógio local está à frente do UTC no instante dado (ms). */
function offsetAt(instant: number, timezone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  const local = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return local - instant;
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
