import { describe, expect, it } from "vitest";

import {
  MAX_BUDGET_CENTS,
  parseBudgetForm,
  parseProgressForm,
} from "@/features/stages/schemas";

const ids = new Set(["s1", "s2"]);

describe("parseBudgetForm", () => {
  it("lê os valores e trata vazio como sem previsto", () => {
    const result = parseBudgetForm(
      [
        ["budget.s1", "900000"],
        ["budget.s2", ""],
        ["estimate_area", "120"],
      ],
      ids,
    );
    expect(result).toEqual({
      ok: true,
      items: [
        { stage_id: "s1", budget_cents: 900000 },
        { stage_id: "s2", budget_cents: null },
      ],
      estimate: null,
    });
  });

  it("ignora etapas de fora da obra", () => {
    const result = parseBudgetForm([["budget.outra", "100"]], ids);
    expect(result.ok && result.items).toEqual([]);
  });

  it("recusa valor que não é número ou grande demais", () => {
    expect(parseBudgetForm([["budget.s1", "12a"]], ids).ok).toBe(false);
    expect(
      parseBudgetForm([["budget.s1", String(MAX_BUDGET_CENTS + 1)]], ids).ok,
    ).toBe(false);
  });

  it("guarda área e custo por m² quando a estimativa foi usada", () => {
    const result = parseBudgetForm(
      [
        ["estimate_applied", "1"],
        ["estimate_area", "85,555"],
        ["estimate_cost", "250000"],
      ],
      ids,
    );
    expect(result.ok && result.estimate).toEqual({
      areaM2: 85.56,
      costPerM2Cents: 250000,
    });
  });

  it("estimativa com área inválida aponta o campo", () => {
    expect(
      parseBudgetForm(
        [
          ["estimate_applied", "1"],
          ["estimate_area", "abc"],
        ],
        ids,
      ),
    ).toMatchObject({ ok: false, field: "area" });
  });
});

describe("parseProgressForm", () => {
  it("lê progresso de 0 a 100", () => {
    expect(
      parseProgressForm(
        [
          ["progress.s1", "40"],
          ["progress.s2", "100"],
        ],
        ids,
      ),
    ).toEqual({
      ok: true,
      items: [
        { stage_id: "s1", progress_percent: 40 },
        { stage_id: "s2", progress_percent: 100 },
      ],
    });
  });

  it("recusa fora da faixa", () => {
    expect(parseProgressForm([["progress.s1", "101"]], ids).ok).toBe(false);
    expect(parseProgressForm([["progress.s1", "-5"]], ids).ok).toBe(false);
  });
});
