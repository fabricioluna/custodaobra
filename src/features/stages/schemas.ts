import { z } from "zod";

import { parseQuantity } from "@/lib/money";

import { stagesCopy } from "./copy";

const { errors } = stagesCopy;

/** Teto do previsto de uma etapa: R$ 999 milhões (o que o campo aceita). */
export const MAX_BUDGET_CENTS = 99_999_999_999;

export const BUDGET_PREFIX = "budget.";
export const PROGRESS_PREFIX = "progress.";

const centsSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .pipe(
    z
      .string()
      .regex(/^\d+$/, { error: errors.invalidAmount })
      .transform(Number)
      .pipe(z.number().int().max(MAX_BUDGET_CENTS, errors.invalidAmount))
      .nullable(),
  );

const progressSchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}$/, { error: errors.invalidProgress })
  .transform(Number)
  .pipe(z.number().int().min(0).max(100, errors.invalidProgress));

type Entries = [string, FormDataEntryValue][];

function prefixed(entries: Entries, prefix: string) {
  return entries
    .filter(
      (entry): entry is [string, string] =>
        entry[0].startsWith(prefix) && typeof entry[1] === "string",
    )
    .map(([key, value]) => ({ stageId: key.slice(prefix.length), value }));
}

export type BudgetFormResult =
  | {
      ok: true;
      items: { stage_id: string; budget_cents: number | null }[];
      estimate: { areaM2: number; costPerM2Cents: number } | null;
    }
  | { ok: false; message: string; field?: "area" };

/**
 * Lê o formulário de orçamento: `budget.<stageId>` em centavos (vazio limpa)
 * e, se a estimativa foi usada, a área e o custo por m² para guardar na obra.
 */
export function parseBudgetForm(
  entries: Entries,
  stageIds: Set<string>,
): BudgetFormResult {
  const items: { stage_id: string; budget_cents: number | null }[] = [];
  for (const { stageId, value } of prefixed(entries, BUDGET_PREFIX)) {
    if (!stageIds.has(stageId)) continue;
    const parsed = centsSchema.safeParse(value);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "" };
    }
    items.push({ stage_id: stageId, budget_cents: parsed.data });
  }

  const get = (name: string) => {
    const found = entries.find(([key]) => key === name)?.[1];
    return typeof found === "string" ? found : "";
  };
  let estimate = null;
  if (get("estimate_applied") === "1") {
    const areaM2 = parseQuantity(get("estimate_area"));
    const cost = centsSchema.safeParse(get("estimate_cost"));
    if (!areaM2 || areaM2 > 99_999_999) {
      return { ok: false, message: errors.invalidArea, field: "area" };
    }
    if (cost.success && cost.data) {
      estimate = {
        areaM2: Math.round(areaM2 * 100) / 100,
        costPerM2Cents: cost.data,
      };
    }
  }
  return { ok: true, items, estimate };
}

/** Lê o formulário de progresso: `progress.<stageId>` de 0 a 100. */
export function parseProgressForm(
  entries: Entries,
  stageIds: Set<string>,
):
  | { ok: true; items: { stage_id: string; progress_percent: number }[] }
  | { ok: false; message: string } {
  const items: { stage_id: string; progress_percent: number }[] = [];
  for (const { stageId, value } of prefixed(entries, PROGRESS_PREFIX)) {
    if (!stageIds.has(stageId)) continue;
    const parsed = progressSchema.safeParse(value);
    if (!parsed.success) {
      return { ok: false, message: errors.invalidProgress };
    }
    items.push({ stage_id: stageId, progress_percent: parsed.data });
  }
  return { ok: true, items };
}
