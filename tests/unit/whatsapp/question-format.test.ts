import { describe, expect, it } from "vitest";

import type { ExpenseFilters } from "@/lib/ai/query-tools";
import type { QueryAnswer } from "@/lib/whatsapp/queries";
import {
  describePeriod,
  formatAnswer,
  formatAnswers,
} from "@/lib/whatsapp/question-format";

const nbsp = (text: string) => text.replace(/ /g, " ");

const context = {
  today: "2026-11-09",
  projectName: "Casa nova",
  stages: [
    { id: "s-alvenaria", name: "Alvenaria" },
    { id: "s-cobertura", name: "Cobertura" },
  ],
};

const noFilters: ExpenseFilters = {
  from: null,
  to: null,
  stageId: null,
  categoryCode: null,
  supplier: null,
  search: null,
  paymentMethod: null,
};

const format = (answer: QueryAnswer) => nbsp(formatAnswer(answer, context));

describe("describePeriod", () => {
  it.each([
    [null, null, null],
    ["2026-10-01", "2026-10-31", "outubro de 2026"],
    ["2026-02-01", "2026-02-28", "fevereiro de 2026"],
    ["2026-01-01", "2026-12-31", "2026"],
    ["2026-11-09", "2026-11-09", "hoje"],
    ["2026-11-08", "2026-11-08", "ontem"],
    ["2026-11-01", "2026-11-09", "de 01/11/2026 a 09/11/2026"],
    ["2026-03-01", null, "desde 01/03/2026"],
    [null, "2026-10-15", "até 15/10/2026"],
  ])("%s a %s → %s", (from, to, expected) => {
    expect(describePeriod(from, to, context.today)).toBe(expected);
  });
});

describe("formatAnswer", () => {
  it("total com filtros no título", () => {
    const text = format({
      name: "total_spent",
      filters: {
        ...noFilters,
        from: "2026-10-01",
        to: "2026-10-31",
        search: "cimento",
        stageId: "s-alvenaria",
        paymentMethod: "pix",
      },
      totalCents: 123_400,
      landCents: 0,
      count: 12,
    });
    expect(text).toContain(
      "*Gasto · outubro de 2026 · etapa Alvenaria · “cimento” · pix*",
    );
    expect(text).toContain("*R$ 1.234,00* em 12 gastos");
    expect(text).not.toContain("Terreno");
  });

  it("total da obra separa construção e terreno", () => {
    const text = format({
      name: "total_spent",
      filters: noFilters,
      totalCents: 10_000_000,
      landCents: 4_000_000,
      count: 30,
    });
    expect(text).toContain("*Gasto*");
    expect(text).toContain("Construção: R$ 60.000,00");
    expect(text).toContain("Terreno: R$ 40.000,00");
  });

  it("sem gasto, diz onde procurou a palavra", () => {
    const text = format({
      name: "total_spent",
      filters: { ...noFilters, search: "telha" },
      totalCents: 0,
      landCents: 0,
      count: 0,
    });
    expect(text).toContain("Nenhum gasto confirmado com “telha” na descrição.");
  });

  it("divisão por etapa com percentuais, sem etapa e outros", () => {
    const groups = [
      { label: "Alvenaria", cents: 50_000 },
      { label: null, cents: 20_000 },
      ...Array.from({ length: 6 }, (_, i) => ({
        label: `Etapa ${i}`,
        cents: 5_000,
      })),
    ];
    const text = format({
      name: "spending_breakdown",
      filters: noFilters,
      groupBy: "stage",
      groups,
      totalCents: 100_000,
      count: 9,
    });
    expect(text).toContain("*Gasto por etapa*");
    expect(text).toContain("• Alvenaria: R$ 500,00 (50%)");
    expect(text).toContain("• Sem etapa: R$ 200,00 (20%)");
    expect(text).toContain("• Outros (2): R$ 100,00 (10%)");
    expect(text).toContain("Total: *R$ 1.000,00* em 9 gastos");
  });

  it("divisão por categoria e por mês", () => {
    const byCategory = format({
      name: "spending_breakdown",
      filters: noFilters,
      groupBy: "category",
      groups: [{ label: "mao_de_obra", cents: 30_000 }],
      totalCents: 30_000,
      count: 1,
    });
    expect(byCategory).toContain("• Mão de obra: R$ 300,00 (100%)");

    const byMonth = format({
      name: "spending_breakdown",
      filters: noFilters,
      groupBy: "month",
      groups: [
        { label: "2026-10", cents: 10_000 },
        { label: "2026-11", cents: 30_000 },
      ],
      totalCents: 40_000,
      count: 4,
    });
    expect(byMonth.indexOf("out/2026")).toBeLessThan(
      byMonth.indexOf("nov/2026"),
    );
  });

  it("últimos gastos com data relativa e fornecedor", () => {
    const text = format({
      name: "recent_expenses",
      filters: noFilters,
      items: [
        {
          amountCents: 7_800,
          description: "Cimento (2 sacos)",
          spentOn: "2026-11-09",
          stageName: null,
          categoryCode: "material",
          supplierName: "Loja do Zé",
        },
      ],
    });
    expect(text).toContain("*Últimos gastos*");
    expect(text).toContain(
      "• hoje · R$ 78,00 · Cimento (2 sacos) · Loja do Zé",
    );
  });

  it("orçamento de uma etapa estourada e à frente do andamento", () => {
    const text = format({
      name: "budget_status",
      stageId: "s-alvenaria",
      stages: [
        {
          id: "s-alvenaria",
          name: "Alvenaria",
          budgetCents: 100_000,
          spentCents: 90_000,
          committedCents: 20_000,
          progressPercent: 50,
        },
      ],
    });
    expect(text).toContain("*Orçamento · Alvenaria*");
    expect(text).toContain("Gasto: *R$ 900,00* (90%)");
    expect(text).toContain("Contas a pagar: R$ 200,00");
    expect(text).toContain("🔴 Passou do previsto: R$ 100,00");
    expect(text).toContain("e a etapa está em 50% de andamento");
  });

  it("orçamento da obra lista as etapas para olhar", () => {
    const stage = (name: string, budget: number | null, spent: number) => ({
      id: name,
      name,
      budgetCents: budget,
      spentCents: spent,
      committedCents: 0,
      progressPercent: 0,
    });
    const text = format({
      name: "budget_status",
      stageId: null,
      stages: [
        stage("Fundação", 100_000, 50_000),
        stage("Alvenaria", 100_000, 85_000),
        stage("Cobertura", 100_000, 120_000),
        stage("Pintura", null, 0),
      ],
    });
    expect(text).toContain("Previsto: R$ 3.000,00");
    expect(text).toContain("Gasto: *R$ 2.550,00* (85%)");
    expect(text).toContain("Sobra: R$ 450,00");
    expect(text.indexOf("🔴 Cobertura")).toBeLessThan(
      text.indexOf("🟡 Alvenaria"),
    );
    expect(text).not.toContain("Fundação");
  });

  it("orçamento ainda não definido", () => {
    const text = format({
      name: "budget_status",
      stageId: null,
      stages: [
        {
          id: "s",
          name: "Alvenaria",
          budgetCents: null,
          spentCents: 5_000,
          committedCents: 0,
          progressPercent: 0,
        },
      ],
    });
    expect(text).toContain("O previsto ainda não foi definido");
  });

  it("contas atrasadas com o que não coube", () => {
    const text = format({
      name: "payables",
      status: "overdue",
      from: null,
      to: null,
      items: [
        {
          description: "Pedreiro",
          amountCents: 50_000,
          dueDate: "2026-11-05",
          supplierName: "João",
        },
      ],
      totalCents: 80_000,
      count: 3,
    });
    expect(text).toContain("*Contas atrasadas*");
    expect(text).toContain("3 contas · *R$ 800,00*");
    expect(text).toContain("• 05/11/2026 · R$ 500,00 · Pedreiro · João");
    expect(text).toContain("…e mais 2 contas");
  });

  it("nenhuma conta atrasada", () => {
    const text = format({
      name: "payables",
      status: "overdue",
      from: null,
      to: null,
      items: [],
      totalCents: 0,
      count: 0,
    });
    expect(text).toContain("Nenhuma conta atrasada.");
  });
});

describe("formatAnswers", () => {
  it("junta as respostas e põe a obra embaixo", () => {
    const answer: QueryAnswer = {
      name: "total_spent",
      filters: { ...noFilters, search: "cimento" },
      totalCents: 10_000,
      landCents: 0,
      count: 1,
    };
    const text = nbsp(
      formatAnswers(
        [answer, { ...answer, filters: { ...noFilters, search: "areia" } }],
        context,
      ),
    );
    expect(text).toContain("“cimento”");
    expect(text).toContain("“areia”");
    expect(text.endsWith("_Obra: Casa nova_")).toBe(true);
  });
});
