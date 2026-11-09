import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { buildUserMessage, interpretAiExpense } =
  await import("@/lib/ai/extract-expense");
type AiExpense = import("@/lib/ai/extract-expense").AiExpense;

const context = {
  today: "2026-11-09",
  stages: [
    { id: "s-fundacao", name: "Fundação" },
    { id: "s-alvenaria", name: "Alvenaria" },
    { id: "s-cobertura", name: "Cobertura" },
  ],
  suppliers: ["Loja do Zé"],
};

const raw = (fields: Partial<AiExpense> = {}): AiExpense => ({
  intent: "expense",
  amount_brl: 300,
  quantity: null,
  unit: null,
  description: "pedreiro",
  category_code: "mao_de_obra",
  stage_number: null,
  supplier_name: null,
  spent_on: "2026-11-09",
  payment_method: null,
  has_invoice: false,
  confidence: 0.9,
  missing_fields: [],
  ...fields,
});

describe("buildUserMessage", () => {
  it("leva hoje com o dia da semana, as etapas numeradas e os fornecedores", () => {
    const message = buildUserMessage("300 pedreiro", context);
    expect(message).toContain("Hoje: 2026-11-09 (segunda-feira)");
    expect(message).toContain("1. Fundação\n2. Alvenaria\n3. Cobertura");
    expect(message).toContain("Loja do Zé");
    expect(message).toContain("<mensagem>\n300 pedreiro\n</mensagem>");
  });

  it("obra sem etapas e sem fornecedores", () => {
    const message = buildUserMessage("oi", {
      ...context,
      stages: [],
      suppliers: [],
    });
    expect(message).toContain("(a obra não tem etapas)");
    expect(message).toContain("(nenhum ainda)");
  });
});

describe("interpretAiExpense", () => {
  it("converte reais em centavos e capitaliza a descrição", () => {
    const result = interpretAiExpense(raw({ amount_brl: 78.5 }), "x", context);
    expect(result?.amountCents).toBe(7850);
    expect(result?.description).toBe("Pedreiro");
    expect(result?.categoryCode).toBe("mao_de_obra");
  });

  it("arredonda centavos sem erro de ponto flutuante", () => {
    expect(
      interpretAiExpense(raw({ amount_brl: 1890.9 }), "x", context)
        ?.amountCents,
    ).toBe(189090);
  });

  it("mensagem que não é gasto devolve null", () => {
    expect(interpretAiExpense(raw({ intent: "other" }), "oi", context)).toBe(
      null,
    );
  });

  it.each([null, 0, -5, 10_000_000, Number.NaN])(
    "valor %s vira 'falta valor'",
    (amount) => {
      const result = interpretAiExpense(
        raw({ amount_brl: amount }),
        "x",
        context,
      );
      expect(result?.amountCents).toBeNull();
      expect(result?.missing).toContain("amount");
    },
  );

  it("etapa pelo número da lista; fora da lista vira 'sem etapa'", () => {
    expect(
      interpretAiExpense(raw({ stage_number: 3 }), "x", context)?.stageId,
    ).toBe("s-cobertura");
    const outside = interpretAiExpense(raw({ stage_number: 9 }), "x", context);
    expect(outside?.stageId).toBeNull();
    expect(outside?.missing).toContain("stage");
    expect(
      interpretAiExpense(raw({ stage_number: 0 }), "x", context)?.stageId,
    ).toBeNull();
  });

  it("obra sem etapas não pergunta a etapa", () => {
    const result = interpretAiExpense(raw(), "x", { ...context, stages: [] });
    expect(result?.missing).toEqual([]);
  });

  it("data: aceita até amanhã; futura, inválida ou ausente vira hoje", () => {
    const at = (spent_on: string | null) =>
      interpretAiExpense(raw({ spent_on }), "x", context)?.spentOn;
    expect(at("2026-11-08")).toBe("2026-11-08");
    expect(at("2026-11-10")).toBe("2026-11-10");
    expect(at("2026-11-11")).toBe("2026-11-09");
    expect(at("09/11/2026")).toBe("2026-11-09");
    expect(at("2026-02-30")).toBe("2026-11-09");
    expect(at(null)).toBe("2026-11-09");
  });

  it("sem descrição, usa o texto da mensagem; sem categoria, Outros", () => {
    const result = interpretAiExpense(
      raw({ description: "  ", category_code: null }),
      "  areia   lavada ",
      context,
    );
    expect(result?.description).toBe("Areia lavada");
    expect(result?.categoryCode).toBe("outros");
  });

  it("quantidade só se positiva; unidade só com quantidade", () => {
    expect(
      interpretAiExpense(raw({ quantity: 2, unit: "saco" }), "x", context),
    ).toMatchObject({ quantity: 2, unit: "saco" });
    expect(
      interpretAiExpense(raw({ quantity: -1, unit: "saco" }), "x", context),
    ).toMatchObject({ quantity: null, unit: null });
  });

  it("confiança fica entre 0 e 1", () => {
    expect(
      interpretAiExpense(raw({ confidence: 7 }), "x", context)?.confidence,
    ).toBe(1);
    expect(
      interpretAiExpense(raw({ confidence: -1 }), "x", context)?.confidence,
    ).toBe(0);
  });
});
