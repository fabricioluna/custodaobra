import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { buildQuestionMessage, interpretToolCalls, QUERY_TOOLS } =
  await import("@/lib/ai/query-tools");

const context = {
  today: "2026-11-09",
  stages: [
    { id: "s-fundacao", name: "Fundação" },
    { id: "s-alvenaria", name: "Alvenaria" },
  ],
  suppliers: ["Loja do Zé"],
};

const filters = (fields: Record<string, unknown> = {}) => ({
  view: "total",
  group_by: null,
  limit: null,
  from: null,
  to: null,
  stage_number: null,
  category_code: null,
  supplier: null,
  search: null,
  payment_method: null,
  ...fields,
});

const call = (name: string, input: Record<string, unknown>) => ({
  name,
  input,
});

describe("QUERY_TOOLS", () => {
  it("três ferramentas no formato do modo strict", () => {
    expect(QUERY_TOOLS.map((tool) => tool.name)).toEqual([
      "expenses",
      "budget_status",
      "payables",
    ]);
    for (const tool of QUERY_TOOLS) {
      expect(tool.strict).toBe(true);
      const schema = tool.input_schema as Record<string, unknown>;
      expect(schema.type).toBe("object");
      expect(schema.additionalProperties).toBe(false);
      expect(schema).not.toHaveProperty("$schema");
      // Todo campo é obrigatório (nulo quando não vale).
      expect(schema.required).toEqual(Object.keys(schema.properties as object));
      // Limites numéricos não valem no modo strict: ficam no código.
      expect(JSON.stringify(schema)).not.toContain("minimum");
    }
  });

  it("no máximo 16 parâmetros que podem ser nulos, somando as ferramentas", () => {
    // Limite da API no modo strict (acima disso, erro 400).
    const unions = QUERY_TOOLS.flatMap((tool) =>
      Object.values(
        (tool.input_schema as { properties: Record<string, object> })
          .properties,
      ),
    ).filter(
      (property) =>
        "anyOf" in property ||
        Array.isArray((property as { type?: unknown }).type),
    );
    expect(unions.length).toBeLessThanOrEqual(16);
  });
});

describe("buildQuestionMessage", () => {
  it("leva hoje, as etapas numeradas, os fornecedores e a pergunta", () => {
    const message = buildQuestionMessage("quanto gastei?", context);
    expect(message).toContain("Hoje: 2026-11-09 (segunda-feira)");
    expect(message).toContain("1. Fundação\n2. Alvenaria");
    expect(message).toContain("Fornecedores recentes: Loja do Zé");
    expect(message).toContain("<pergunta>\nquanto gastei?\n</pergunta>");
  });
});

describe("interpretToolCalls", () => {
  it("converte a etapa pelo número e limpa os textos", () => {
    const [result] = interpretToolCalls(
      [
        call(
          "expenses",
          filters({
            stage_number: 2,
            search: "  cimento ",
            category_code: "material",
            from: "2026-10-01",
            to: "2026-10-31",
          }),
        ),
      ],
      context,
    );
    expect(result).toEqual({
      name: "total_spent",
      filters: {
        from: "2026-10-01",
        to: "2026-10-31",
        stageId: "s-alvenaria",
        categoryCode: "material",
        supplier: null,
        search: "cimento",
        paymentMethod: null,
      },
    });
  });

  it("descarta etapa fora da lista e data inválida", () => {
    expect(
      interpretToolCalls(
        [
          call("expenses", filters({ stage_number: 9 })),
          call("expenses", filters({ from: "2026-02-30" })),
          call("budget_status", { stage_number: 0 }),
          call("payables", { status: "open", from: "ontem", to: null }),
        ],
        context,
      ),
    ).toEqual([]);
  });

  it("troca o período fora de ordem", () => {
    const [result] = interpretToolCalls(
      [call("expenses", filters({ from: "2026-10-31", to: "2026-10-01" }))],
      context,
    );
    expect(result).toMatchObject({
      filters: { from: "2026-10-01", to: "2026-10-31" },
    });
  });

  it("descarta função desconhecida e entrada fora do esquema", () => {
    expect(
      interpretToolCalls(
        [
          call("run_sql", { query: "select 1" }),
          call("expenses", filters({ view: "by_group", group_by: "dia" })),
          call("expenses", { from: null }),
          call("total_spent", filters()),
        ],
        context,
      ),
    ).toEqual([]);
  });

  it("limita a lista entre 1 e 10, com 5 por padrão", () => {
    const limits = interpretToolCalls(
      [
        call("expenses", filters({ view: "list", limit: null })),
        call("expenses", filters({ view: "list", limit: 50 })),
        call("expenses", filters({ view: "list", limit: 0 })),
      ],
      context,
    ).map((result) => (result.name === "recent_expenses" ? result.limit : 0));
    expect(limits).toEqual([5, 10, 1]);
  });

  it("divisão sem grupo dito vai por etapa", () => {
    const [result] = interpretToolCalls(
      [call("expenses", filters({ view: "by_group" }))],
      context,
    );
    expect(result).toMatchObject({
      name: "spending_breakdown",
      groupBy: "stage",
    });
  });

  it("no máximo 3 consultas", () => {
    const calls = Array.from({ length: 5 }, () => call("expenses", filters()));
    expect(interpretToolCalls(calls, context)).toHaveLength(3);
  });

  it("orçamento da obra toda e contas a vencer", () => {
    expect(
      interpretToolCalls(
        [
          call("budget_status", { stage_number: null }),
          call("payables", {
            status: "upcoming",
            from: "2026-11-09",
            to: "2026-11-15",
          }),
        ],
        context,
      ),
    ).toEqual([
      { name: "budget_status", stageId: null },
      {
        name: "payables",
        status: "upcoming",
        from: "2026-11-09",
        to: "2026-11-15",
      },
    ]);
  });
});
