import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import fixtures from "../fixtures/receipts.json";

vi.mock("server-only", () => ({}));

const { readReceipt, receiptMimeType } = await import("@/lib/ai/read-receipt");

/**
 * Avaliação da leitura de comprovantes com a API de verdade (custa pouco:
 * Haiku, 6 arquivos). Roda só com `npm run test:ai` e ANTHROPIC_API_KEY;
 * fora do CI.
 *
 * Os comprovantes são fictícios, gerados por `node
 * scripts/generate-receipts.mjs` (sem dados de ninguém). Campos ausentes em
 * "expect" não são conferidos.
 */
type Expect = {
  is_receipt: boolean;
  amount_cents?: number;
  category?: string;
  stage?: string;
  spent_on?: string;
  payment_method?: string;
  has_invoice?: boolean;
  supplier_document?: string;
  access_key?: string;
  items?: number;
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
  "leitura de comprovantes (IA de visão)",
  () => {
    it.concurrent.each(
      fixtures.receipts.map(
        (r) => [r.file, r.caption, r.expect as Expect] as const,
      ),
    )("%s", async (file, caption, want) => {
      const data = await readFile(
        path.join("tests", "fixtures", "receipts", file),
      );
      const mimeType = receiptMimeType(
        file.endsWith(".pdf") ? "application/pdf" : "image/png",
      );
      if (!mimeType) throw new Error("tipo");
      const result = await readReceipt({ data, mimeType }, caption, context);
      if (result.usage) {
        tokens.input += result.usage.inputTokens;
        tokens.output += result.usage.outputTokens;
      }
      expect(result.kind).not.toBe("failed");

      if (!want.is_receipt) {
        expect(result.kind).toBe("not_receipt");
        return;
      }
      if (result.kind !== "receipt")
        throw new Error(`esperava comprovante: ${result.kind}`);
      const { expense, details } = result;

      if (want.amount_cents !== undefined)
        expect(expense.amountCents).toBe(want.amount_cents);
      if (want.category) expect(expense.categoryCode).toBe(want.category);
      if (want.stage) expect(stageName(expense.stageId)).toBe(want.stage);
      if (want.spent_on) expect(expense.spentOn).toBe(want.spent_on);
      if (want.payment_method)
        expect(expense.paymentMethod).toBe(want.payment_method);
      if (want.has_invoice !== undefined)
        expect(expense.hasInvoice).toBe(want.has_invoice);
      if (want.supplier_document)
        expect(details.supplierDocument).toBe(want.supplier_document);
      if (want.access_key) expect(details.accessKey).toBe(want.access_key);
      if (want.items !== undefined)
        expect(details.items).toHaveLength(want.items);
      expect(expense.supplierName).toBeTruthy();
    });

    afterAll(() => {
      console.info(
        `[ia] ${fixtures.receipts.length} comprovantes: ${tokens.input} tokens de entrada, ${tokens.output} de saída`,
      );
    });
  },
);
