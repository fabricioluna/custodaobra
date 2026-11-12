import { z } from "zod";

import { DEFAULT_TIMEZONE } from "@/config/app";
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
  if (!mode) return { text: copy.normal, tone: "normal" };
  const started = at === null || new Date(at).getTime() <= now.getTime();
  if (mode === "blocked") {
    return started
      ? { text: copy.blocked, tone: "blocked" }
      : {
          text: copy.blockedFrom(accessDate(mode, at!, timezone)),
          tone: "scheduled",
        };
  }
  if (at === null) return { text: copy.free, tone: "free" };
  return started
    ? { text: copy.freeExpired, tone: "normal" }
    : { text: copy.freeUntil(accessDate(mode, at, timezone)), tone: "free" };
}
