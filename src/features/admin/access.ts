import { z } from "zod";

import { DEFAULT_TIMEZONE } from "@/config/app";
import { overrideStatus } from "@/lib/billing/limits";
import { addDays, isIsoDate, startOfDayIn, todayIn } from "@/lib/dates";
import type { Database } from "@/types/database";

import { adminCopy } from "./copy";

/**
 * Regras do acesso decidido pela equipe no painel interno. As datas são
 * dias do calendário no fuso padrão do app:
 * - liberar até D: vale até o fim do dia D (o banco guarda a meia-noite de D+1);
 * - bloquear a partir de D: vale desde a meia-noite de D.
 */

export type AccessOverride = Database["public"]["Enums"]["access_override"];
export type AccessMode = "normal" | AccessOverride;

const errors = adminCopy.access.errors;

export const accessFormSchema = z
  .object({
    mode: z.enum(["normal", "free", "blocked"], { error: errors.mode }),
    date: z
      .string()
      .trim()
      .refine((value) => value === "" || isIsoDate(value), errors.date),
    note: z.string().trim().max(500, errors.note),
    planCode: z.string().trim().max(50),
  })
  .superRefine((value, ctx) => {
    if (
      value.mode === "free" &&
      value.date !== "" &&
      value.date < todayIn(DEFAULT_TIMEZONE)
    ) {
      ctx.addIssue({ code: "custom", path: ["date"], message: errors.past });
    }
  });

export type AccessForm = z.infer<typeof accessFormSchema>;

/** Instante guardado em access_override_at para o modo e o dia escolhidos. */
export function accessOverrideAt(
  mode: AccessMode,
  date: string,
  timezone: string = DEFAULT_TIMEZONE,
): string | null {
  if (mode === "normal" || date === "") return null;
  return mode === "free"
    ? startOfDayIn(addDays(date, 1), timezone)
    : startOfDayIn(date, timezone);
}

/**
 * O dia escolhido de volta, a partir do instante guardado (para preencher o
 * formulário e mostrar na lista).
 */
export function accessDate(
  mode: AccessOverride,
  at: string,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const day = todayIn(timezone, new Date(at));
  return mode === "free" ? addDays(day, -1) : day;
}

export type AccessLabel = {
  text: string;
  tone: "normal" | "free" | "blocked" | "scheduled";
};

/** Etiqueta do acesso na lista do painel. */
export function accessLabel(
  mode: AccessOverride | null,
  at: string | null,
  now: Date = new Date(),
  timezone: string = DEFAULT_TIMEZONE,
): AccessLabel {
  const copy = adminCopy.access.labels;
  // A mesma regra que decide o acesso de verdade (limits.ts).
  switch (overrideStatus(mode, at, now)) {
    case "none":
      return { text: copy.normal, tone: "normal" };
    case "suspended":
      return { text: copy.blocked, tone: "blocked" };
    case "suspension_scheduled":
      return {
        text: copy.blockedFrom(accessDate("blocked", at!, timezone)),
        tone: "scheduled",
      };
    case "granted_expired":
      return { text: copy.freeExpired, tone: "normal" };
    case "granted":
      return at === null
        ? { text: copy.free, tone: "free" }
        : {
            text: copy.freeUntil(accessDate("free", at, timezone)),
            tone: "free",
          };
  }
}

/**
 * Como o formulário abre: liberação vencida abre como regra normal (é o que
 * vale), para salvar o plano ou o motivo sem esbarrar em "a data já passou".
 */
export function accessFormDefaults(
  mode: AccessOverride | null,
  at: string | null,
  now: Date = new Date(),
  timezone: string = DEFAULT_TIMEZONE,
): { mode: AccessMode; date: string } {
  const status = overrideStatus(mode, at, now);
  if (!mode || status === "granted_expired")
    return { mode: "normal", date: "" };
  return { mode, date: at ? accessDate(mode, at, timezone) : "" };
}
