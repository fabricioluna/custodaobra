import { describe, expect, it } from "vitest";

import {
  perSquareMeterCents,
  reportFileTitle,
  sharePercent,
} from "@/features/reports/summary";

describe("perSquareMeterCents", () => {
  it("divide o gasto da construção pela área", () => {
    expect(perSquareMeterCents(20_000_000, 100)).toBe(200_000);
    expect(perSquareMeterCents(10_000_000, 85.5)).toBe(116_959);
  });

  it("sem área ou sem gasto não tem custo por m²", () => {
    expect(perSquareMeterCents(20_000_000, null)).toBeNull();
    expect(perSquareMeterCents(20_000_000, 0)).toBeNull();
    expect(perSquareMeterCents(0, 100)).toBeNull();
  });
});

describe("sharePercent", () => {
  it("arredonda a parte do total", () => {
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(2, 3)).toBe(67);
    expect(sharePercent(50, 50)).toBe(100);
  });

  it("total zero vira 0%", () => {
    expect(sharePercent(0, 0)).toBe(0);
  });
});

describe("reportFileTitle", () => {
  it("monta o nome do PDF com a obra e a data", () => {
    expect(reportFileTitle("Casa do Jardim", "2026-11-09")).toBe(
      "Relatório - Casa do Jardim - 2026-11-09",
    );
  });

  it("tira caracteres que não podem ir no nome do arquivo", () => {
    expect(reportFileTitle('Casa 1/2: "nova"', "2026-11-09")).toBe(
      "Relatório - Casa 1 2 nova - 2026-11-09",
    );
    expect(reportFileTitle("  ", "2026-11-09")).toBe(
      "Relatório - obra - 2026-11-09",
    );
  });
});
