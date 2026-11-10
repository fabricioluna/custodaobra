import { describe, expect, it } from "vitest";

import { formatProjectSummary } from "@/lib/whatsapp/messages";

const base = {
  projectName: "Casa nova",
  constructionCents: 0,
  landCents: 0,
  budgetCents: 0,
  committedCents: 0,
  unclassifiedCount: 0,
  stages: [],
};

const nbsp = (text: string) => text.replace(/ /g, " ");

describe("formatProjectSummary", () => {
  it("obra sem gastos nem orçamento", () => {
    const text = nbsp(formatProjectSummary(base));
    expect(text).toContain("*Resumo · Casa nova*");
    expect(text).toContain("Gasto na construção: *R$ 0,00*");
    expect(text).toContain("Previsto: ainda não definido");
    expect(text).toContain("Nenhum gasto confirmado ainda.");
  });

  it("mostra previsto, terreno, contas e as 5 etapas com mais gasto", () => {
    const text = nbsp(
      formatProjectSummary({
        ...base,
        constructionCents: 5_000_000,
        landCents: 8_000_000,
        budgetCents: 20_000_000,
        committedCents: 150_000,
        unclassifiedCount: 2,
        stages: [
          { name: "Fundação", spentCents: 1_000_000, budgetCents: 1_600_000 },
          { name: "Estrutura", spentCents: 2_000_000, budgetCents: null },
          { name: "Alvenaria", spentCents: 500_000, budgetCents: null },
          { name: "Cobertura", spentCents: 400_000, budgetCents: null },
          { name: "Pintura", spentCents: 300_000, budgetCents: null },
          { name: "Pisos", spentCents: 200_000, budgetCents: null },
          { name: "Limpeza", spentCents: 0, budgetCents: null },
        ],
      }),
    );
    expect(text).toContain("Previsto: R$ 200.000,00 (25% usado)");
    expect(text).toContain("Contas a pagar: R$ 1.500,00");
    expect(text).toContain("Terreno: R$ 80.000,00");
    expect(text).toContain("2 gastos sem etapa");
    const lines = text.split("\n").filter((line) => line.startsWith("• "));
    expect(lines).toEqual([
      "• Estrutura: R$ 20.000,00",
      "• Fundação: R$ 10.000,00 de R$ 16.000,00",
      "• Alvenaria: R$ 5.000,00",
      "• Cobertura: R$ 4.000,00",
      "• Pintura: R$ 3.000,00",
    ]);
  });
});
