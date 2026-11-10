import { afterAll, describe, expect, it, vi } from "vitest";

import fixtures from "../fixtures/whatsapp-messages.json";

vi.mock("server-only", () => ({}));

const { extractExpense } = await import("@/lib/ai/extract-expense");

/**
 * Avaliação com a API de verdade (custa dinheiro, pouco: Haiku). Roda só com
 * `npm run test:ai` e ANTHROPIC_API_KEY definida; fora do CI.
 *
 * Cada mensagem de tests/fixtures/whatsapp-messages.json é lida pela IA e
 * comparada com o esperado. Campos ausentes em "expect" não são conferidos.
 */
type Expect = {
  intent: "expense" | "other";
  amount_cents?: number | null;
  category?: string;
  stage?: string | null;
  quantity?: number;
  supplier?: string;
  payment_method?: string;
  has_invoice?: boolean;
  spent_on?: string;
};

const context = {
  today: fixtures.today,
  stages: fixtures.stages.map((name, i) => ({ id: `stage-${i + 1}`, name })),
  suppliers: fixtures.suppliers,
};
const stageName = (id: string | null) =>
  context.stages.find((stage) => stage.id === id)?.name ?? null;

const tokens = { input: 0, output: 0 };

describe.skipIf(!process.env.ANTHROPIC_API_KEY)(
  "extração de gastos (IA)",
  () => {
    it.concurrent.each(
      fixtures.messages.map((m) => [m.text, m.expect as Expect] as const),
    )("%s", async (text, want) => {
      const result = await extractExpense(text, context);
      if (result.usage) {
        tokens.input += result.usage.inputTokens;
        tokens.output += result.usage.outputTokens;
      }
      expect(result.kind).not.toBe("failed");

      if (want.intent === "other") {
        expect(result.kind).toBe("not_expense");
        return;
      }
      if (result.kind !== "expense")
        throw new Error(`esperava gasto: ${result.kind}`);
      const got = result.expense;

      if (want.amount_cents !== undefined)
        expect(got.amountCents).toBe(want.amount_cents);
      if (want.category) expect(got.categoryCode).toBe(want.category);
      if (want.stage !== undefined)
        expect(stageName(got.stageId)).toBe(want.stage);
      if (want.quantity !== undefined) expect(got.quantity).toBe(want.quantity);
      if (want.supplier) expect(got.supplierName).toBe(want.supplier);
      if (want.payment_method)
        expect(got.paymentMethod).toBe(want.payment_method);
      if (want.has_invoice !== undefined)
        expect(got.hasInvoice).toBe(want.has_invoice);
      if (want.spent_on) expect(got.spentOn).toBe(want.spent_on);
    });

    afterAll(() => {
      console.info(
        `[ia] ${fixtures.messages.length} mensagens: ${tokens.input} tokens de entrada, ${tokens.output} de saída`,
      );
    });
  },
);
