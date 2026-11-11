import { afterAll, describe, expect, it, vi } from "vitest";

import type { QueryCall } from "@/lib/ai/query-tools";

import fixtures from "../fixtures/whatsapp-questions.json";

vi.mock("server-only", () => ({}));

const { chooseQueries } = await import("@/lib/ai/answer-question");

/**
 * Avaliação com a API de verdade (custa dinheiro, pouco: Haiku). Roda só com
 * `npm run test:ai` e ANTHROPIC_API_KEY definida; fora do CI.
 *
 * Cada pergunta de tests/fixtures/whatsapp-questions.json vai para a IA, e as
 * consultas escolhidas são comparadas com as esperadas (em qualquer ordem).
 * Só os campos presentes no esperado são conferidos; uma lista de valores
 * aceita qualquer um deles. "calls": [] espera "fora do assunto".
 */
type Value = string | number | null;
type ExpectedCall = Record<string, Value | Value[]>;
type Question = {
  text: string;
  calls: ExpectedCall[];
  alternatives?: ExpectedCall[][];
};

const context = {
  today: fixtures.today,
  stages: fixtures.stages.map((name, i) => ({ id: `stage-${i + 1}`, name })),
  suppliers: fixtures.suppliers,
};
const stageName = (id: string | null) =>
  context.stages.find((stage) => stage.id === id)?.name ?? null;

/** Os campos de uma consulta, com os nomes usados no arquivo de perguntas. */
function fieldsOf(call: QueryCall): Record<string, Value> {
  const base: Record<string, Value> = { name: call.name };
  if ("filters" in call) {
    const f = call.filters;
    Object.assign(base, {
      from: f.from,
      to: f.to,
      stage: stageName(f.stageId),
      category: f.categoryCode,
      supplier: f.supplier,
      search: f.search?.toLocaleLowerCase("pt-BR") ?? null,
      payment_method: f.paymentMethod,
    });
  }
  if (call.name === "spending_breakdown") base.group_by = call.groupBy;
  if (call.name === "recent_expenses") base.limit = call.limit;
  if (call.name === "budget_status") base.stage = stageName(call.stageId);
  if (call.name === "payables") {
    Object.assign(base, { status: call.status, from: call.from, to: call.to });
  }
  return base;
}

function matches(got: Record<string, Value>, want: ExpectedCall): boolean {
  return Object.entries(want).every(([key, expected]) => {
    const options = Array.isArray(expected) ? expected : [expected];
    return options.some((option) => got[key] === option);
  });
}

/** Cada esperado casa com uma consulta diferente (em qualquer ordem). */
function matchesAll(got: QueryCall[], want: ExpectedCall[]): boolean {
  if (got.length !== want.length) return false;
  const remaining = got.map(fieldsOf);
  return want.every((expected) => {
    const index = remaining.findIndex((call) => matches(call, expected));
    if (index < 0) return false;
    remaining.splice(index, 1);
    return true;
  });
}

const tokens = { input: 0, output: 0 };

describe.skipIf(!process.env.ANTHROPIC_API_KEY)("perguntas livres (IA)", () => {
  it.concurrent.each(
    (fixtures.questions as Question[]).map((q) => [q.text, q] as const),
  )("%s", async (_text, question) => {
    const result = await chooseQueries(question.text, context);
    if (result.usage) {
      tokens.input += result.usage.inputTokens;
      tokens.output += result.usage.outputTokens;
    }
    expect(result.kind).not.toBe("failed");

    if (!question.calls.length) {
      expect(result.kind).toBe("off_topic");
      return;
    }
    if (result.kind !== "queries") {
      throw new Error(`esperava consultas: ${result.kind}`);
    }
    const options = [question.calls, ...(question.alternatives ?? [])];
    const ok = options.some((want) => matchesAll(result.calls, want));
    // Mostra o que veio quando não bate.
    expect(ok, JSON.stringify(result.calls.map(fieldsOf))).toBe(true);
  });

  afterAll(() => {
    console.info(
      `[ia] ${fixtures.questions.length} perguntas: ${tokens.input} tokens de entrada, ${tokens.output} de saída`,
    );
  });
});
