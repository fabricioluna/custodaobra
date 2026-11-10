import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { normalizeAccessKey, normalizeDocument } from "@/lib/documents";

import { anthropic, visionModel } from "./client";
import {
  type AiExpense,
  CATEGORY_CODES,
  type ExtractedExpense,
  type ExtractionContext,
  interpretAiExpense,
  PAYMENT_METHODS,
  weekdayOf,
} from "./extract-expense";
import {
  READ_RECEIPT_PROMPT_VERSION,
  READ_RECEIPT_SYSTEM,
} from "./prompts/read-receipt.v1";
import {
  type AiFailureReason,
  type AiUsage,
  parseStructured,
} from "./structured";

export { READ_RECEIPT_PROMPT_VERSION };

/**
 * Lê a foto (ou PDF) de um cupom, nota ou recibo e devolve os dados do
 * lançamento e os detalhes do documento. Como no texto, nada é gravado como
 * definitivo: o gasto nasce pendente e a pessoa confirma.
 */

/** Tipos que a IA lê. HEIC e outros chegam como documento e são recusados. */
export const RECEIPT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const RECEIPT_PDF_TYPE = "application/pdf";
/** Limite da API para imagens; PDFs vão até o limite do bucket. */
export const MAX_RECEIPT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_RECEIPT_PDF_BYTES = 10 * 1024 * 1024;
const MAX_ITEMS = 100;

export type ReceiptMimeType =
  (typeof RECEIPT_IMAGE_TYPES)[number] | typeof RECEIPT_PDF_TYPE;

/** Tipo aceito (sem parâmetros como "; charset"), ou null. */
export function receiptMimeType(mimeType: string): ReceiptMimeType | null {
  const type = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type === RECEIPT_PDF_TYPE) return RECEIPT_PDF_TYPE;
  return (RECEIPT_IMAGE_TYPES as readonly string[]).includes(type)
    ? (type as ReceiptMimeType)
    : null;
}

export function maxReceiptBytes(mimeType: ReceiptMimeType): number {
  return mimeType === RECEIPT_PDF_TYPE
    ? MAX_RECEIPT_PDF_BYTES
    : MAX_RECEIPT_IMAGE_BYTES;
}

const aiItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  unit_price_brl: z.number().nullable(),
  total_brl: z.number().nullable(),
});

export const aiReceiptSchema = z.object({
  is_receipt: z.boolean(),
  is_fiscal: z.boolean(),
  amount_brl: z.number().nullable(),
  description: z.string().nullable(),
  category_code: z.enum(CATEGORY_CODES).nullable(),
  stage_number: z.number().int().nullable(),
  supplier_name: z.string().nullable(),
  supplier_document: z.string().nullable(),
  invoice_number: z.string().nullable(),
  access_key: z.string().nullable(),
  spent_on: z.string().nullable(),
  payment_method: z.enum(PAYMENT_METHODS).nullable(),
  items: z.array(aiItemSchema),
  confidence: z.number(),
  missing_fields: z.array(z.enum(["amount", "stage", "description"])),
});
export type AiReceipt = z.infer<typeof aiReceiptSchema>;

export type ReceiptItem = {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPriceCents: number | null;
  totalCents: number;
};

/** O que o comprovante traz além do lançamento. */
export type ReceiptDetails = {
  supplierDocument: string | null;
  invoiceNumber: string | null;
  accessKey: string | null;
  items: ReceiptItem[];
};

export type ReceiptResult =
  | {
      kind: "receipt";
      expense: ExtractedExpense;
      details: ReceiptDetails;
      usage: AiUsage;
    }
  | { kind: "not_receipt"; usage: AiUsage }
  | { kind: "failed"; reason: AiFailureReason; usage: AiUsage | null };

const toCents = (brl: number | null): number | null =>
  brl === null || !Number.isFinite(brl) ? null : Math.round(brl * 100);

const clean = (value: string | null, max: number): string | null => {
  const text = value?.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

/**
 * Itens só valem se a soma bate com o total. Folga de 2% (mínimo R$ 1) para
 * arredondamento; para cima, até 10%, porque o desconto no fim do cupom deixa
 * a soma dos itens maior que o valor pago. Se não bate, algum item foi lido
 * errado: melhor nenhum do que uma lista errada.
 */
export function interpretItems(
  raw: AiReceipt["items"],
  amountCents: number | null,
): ReceiptItem[] {
  if (amountCents === null || !raw.length || raw.length > MAX_ITEMS) return [];
  const items: ReceiptItem[] = [];
  for (const item of raw) {
    const description = clean(item.description, 200);
    const totalCents = toCents(item.total_brl);
    if (!description || totalCents === null || totalCents < 0) return [];
    const unitPriceCents = toCents(item.unit_price_brl);
    const quantity =
      item.quantity !== null &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0
        ? Math.round(item.quantity * 1000) / 1000
        : null;
    items.push({
      description,
      quantity,
      unit: quantity !== null ? clean(item.unit, 20) : null,
      unitPriceCents:
        unitPriceCents !== null && unitPriceCents > 0 ? unitPriceCents : null,
      totalCents,
    });
  }
  const sum = items.reduce((total, item) => total + item.totalCents, 0);
  const below = Math.max(100, Math.round(amountCents * 0.02));
  const above = Math.max(below, Math.round(amountCents * 0.1));
  const diff = sum - amountCents;
  return diff >= -below && diff <= above ? items : [];
}

/** Regras do app sobre a leitura. Pura, para testar sem chamar a API. */
export function interpretAiReceipt(
  raw: AiReceipt,
  caption: string | null,
  context: ExtractionContext,
): { expense: ExtractedExpense; details: ReceiptDetails } | null {
  if (!raw.is_receipt) return null;
  const asExpense: AiExpense = {
    intent: "expense",
    amount_brl: raw.amount_brl,
    quantity: null,
    unit: null,
    description: raw.description,
    category_code: raw.category_code,
    stage_number: raw.stage_number,
    supplier_name: raw.supplier_name,
    spent_on: raw.spent_on,
    payment_method: raw.payment_method,
    has_invoice: raw.is_fiscal,
    confidence: raw.confidence,
    missing_fields: raw.missing_fields,
  };
  const expense = interpretAiExpense(
    asExpense,
    caption ?? "Comprovante pelo WhatsApp",
    context,
  );
  if (!expense) return null;

  const items = interpretItems(raw.items, expense.amountCents);
  // Um item só, com quantidade: vira quantidade e unidade do lançamento.
  const [single] = items;
  if (items.length === 1 && single && single.quantity !== null) {
    expense.quantity = single.quantity;
    expense.unit = single.unit;
  }

  return {
    expense,
    details: {
      supplierDocument: expense.supplierName
        ? normalizeDocument(raw.supplier_document)
        : null,
      invoiceNumber: clean(raw.invoice_number?.replace(/\D/g, "") ?? null, 60),
      accessKey: normalizeAccessKey(raw.access_key),
      items,
    },
  };
}

/** Texto que vai junto com a imagem: o contexto da obra e a legenda. */
export function buildReceiptText(
  caption: string | null,
  context: ExtractionContext,
): string {
  const stages = context.stages.length
    ? context.stages.map((stage, i) => `${i + 1}. ${stage.name}`).join("\n")
    : "(a obra não tem etapas)";
  const suppliers = context.suppliers.length
    ? context.suppliers.join("; ")
    : "(nenhum ainda)";
  const parts = [
    `Hoje: ${context.today} (${weekdayOf(context.today)})`,
    `Etapas da obra:\n${stages}`,
    `Fornecedores recentes: ${suppliers}`,
  ];
  const text = caption?.trim();
  if (text) {
    parts.push(
      `Legenda da pessoa:\n<legenda>\n${text.slice(0, 500)}\n</legenda>`,
    );
  }
  parts.push("Leia o comprovante acima.");
  return parts.join("\n\n");
}

export async function readReceipt(
  file: { data: ArrayBuffer | Buffer; mimeType: ReceiptMimeType },
  caption: string | null,
  context: ExtractionContext,
): Promise<ReceiptResult> {
  const data = Buffer.from(
    file.data instanceof ArrayBuffer ? new Uint8Array(file.data) : file.data,
  ).toString("base64");
  const media: Anthropic.ContentBlockParam =
    file.mimeType === RECEIPT_PDF_TYPE
      ? {
          type: "document",
          source: { type: "base64", media_type: RECEIPT_PDF_TYPE, data },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: file.mimeType, data },
        };

  const result = await parseStructured(anthropic(), {
    model: visionModel(),
    // Cupom com muitos itens ocupa mais saída que uma mensagem de texto.
    maxTokens: 8192,
    system: READ_RECEIPT_SYSTEM,
    content: [
      media,
      { type: "text", text: buildReceiptText(caption, context) },
    ],
    schema: aiReceiptSchema,
    label: "cupom",
    // Uma imagem leva mais que um texto; sem nova tentativa, para caber no
    // tempo do webhook (a pessoa pode mandar a foto de novo).
    request: { timeout: 45_000, maxRetries: 0 },
  });
  if (!result.ok) {
    return { kind: "failed", reason: result.reason, usage: result.usage };
  }
  const read = interpretAiReceipt(result.data, caption, context);
  return read
    ? { kind: "receipt", ...read, usage: result.usage }
    : { kind: "not_receipt", usage: result.usage };
}
