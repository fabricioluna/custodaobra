import "server-only";

import { z } from "zod";

import { addDays, isIsoDate } from "@/lib/dates";
import { isValidAmountCents } from "@/lib/money";

import { anthropic, extractionModel } from "./client";
import {
  EXTRACT_EXPENSE_PROMPT_VERSION,
  EXTRACT_EXPENSE_SYSTEM,
} from "./prompts/extract-expense.v2";
import {
  type AiFailureReason,
  type AiUsage,
  parseStructured,
} from "./structured";

export { EXTRACT_EXPENSE_PROMPT_VERSION };

/**
 * Lê uma mensagem ("300 pedreiro", "2 sacos de cimento 78 na loja do zé") e
 * devolve os dados do lançamento. Nada daqui é gravado como definitivo: o
 * gasto nasce pendente e a pessoa confirma (CLAUDE.md, princípio 2).
 *
 * A saída da IA passa por dois filtros: o formato (structured outputs, com o
 * esquema Zod abaixo) e as regras do app (valor, data, etapa da lista).
 */

export const CATEGORY_CODES = [
  "material",
  "mao_de_obra",
  "servico_terceirizado",
  "aluguel_equipamentos",
  "frete",
  "taxas_documentacao",
  "terreno",
  "outros",
] as const;
export type CategoryCode = (typeof CATEGORY_CODES)[number];

export const PAYMENT_METHODS = [
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "boleto",
  "transferencia",
  "outro",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * O que o modelo devolve. Valor em reais (número decimal) e etapa pelo número
 * da lista: menos chance de erro do que centavos e UUIDs. A conversão fica
 * no código.
 */
export const aiExpenseSchema = z.object({
  intent: z.enum(["expense", "question", "other"]),
  amount_brl: z.number().nullable(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  description: z.string().nullable(),
  category_code: z.enum(CATEGORY_CODES).nullable(),
  stage_number: z.number().int().nullable(),
  supplier_name: z.string().nullable(),
  spent_on: z.string().nullable(),
  payment_method: z.enum(PAYMENT_METHODS).nullable(),
  has_invoice: z.boolean(),
  confidence: z.number(),
  missing_fields: z.array(z.enum(["amount", "stage", "description"])),
});
export type AiExpense = z.infer<typeof aiExpenseSchema>;

/** Contexto enviado a cada chamada (CLAUDE.md, seção 7). */
export type ExtractionContext = {
  /** Hoje no fuso da organização (AAAA-MM-DD). */
  today: string;
  stages: { id: string; name: string }[];
  /** Nomes dos últimos fornecedores usados (até 20). */
  suppliers: string[];
};

export type ExtractedExpense = {
  amountCents: number | null;
  description: string;
  stageId: string | null;
  categoryCode: CategoryCode;
  supplierName: string | null;
  spentOn: string;
  paymentMethod: PaymentMethod | null;
  hasInvoice: boolean;
  quantity: number | null;
  unit: string | null;
  confidence: number;
  /** O que perguntar antes de confirmar. */
  missing: ("amount" | "stage")[];
};

export type ExtractionUsage = AiUsage;

export type ExtractionResult =
  | { kind: "expense"; expense: ExtractedExpense; usage: ExtractionUsage }
  /** Pergunta sobre os gastos da obra: segue para as funções de consulta. */
  | { kind: "question"; usage: ExtractionUsage }
  | { kind: "not_expense"; usage: ExtractionUsage }
  /** A IA não respondeu ou respondeu fora do formato: perguntar à pessoa. */
  | { kind: "failed"; reason: FailureReason; usage: ExtractionUsage | null };

export type FailureReason = AiFailureReason;

const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

export function weekdayOf(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return (
    WEEKDAYS[new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay()] ?? ""
  );
}

/** Mensagem do usuário: contexto variável + o texto recebido. */
export function buildUserMessage(
  text: string,
  context: ExtractionContext,
): string {
  const stages = context.stages.length
    ? context.stages.map((stage, i) => `${i + 1}. ${stage.name}`).join("\n")
    : "(a obra não tem etapas)";
  const suppliers = context.suppliers.length
    ? context.suppliers.join("; ")
    : "(nenhum ainda)";
  return [
    `Hoje: ${context.today} (${weekdayOf(context.today)})`,
    `Etapas da obra:\n${stages}`,
    `Fornecedores recentes: ${suppliers}`,
    `Mensagem:\n<mensagem>\n${text.slice(0, 2000)}\n</mensagem>`,
  ].join("\n\n");
}

const clean = (value: string | null, max: number): string | null => {
  const text = value?.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

const capitalize = (text: string) =>
  text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);

/**
 * Regras do app sobre a saída da IA. Pura, para testar sem chamar a API:
 * - valor maior que zero e menor que R$ 10 milhões, senão vira "falta valor";
 * - data no formato certo e no máximo 1 dia no futuro, senão vira hoje;
 * - etapa só da lista enviada.
 */
export function interpretAiExpense(
  raw: AiExpense,
  text: string,
  context: ExtractionContext,
): ExtractedExpense | null {
  if (raw.intent !== "expense") return null;

  const cents =
    raw.amount_brl === null || !Number.isFinite(raw.amount_brl)
      ? null
      : Math.round(raw.amount_brl * 100);
  const amountCents =
    cents !== null && isValidAmountCents(cents) ? cents : null;

  const stage =
    raw.stage_number !== null
      ? context.stages[raw.stage_number - 1]
      : undefined;
  const stageId = stage?.id ?? null;

  const spentOn =
    raw.spent_on &&
    isIsoDate(raw.spent_on) &&
    raw.spent_on <= addDays(context.today, 1)
      ? raw.spent_on
      : context.today;

  const quantity =
    raw.quantity !== null && Number.isFinite(raw.quantity) && raw.quantity > 0
      ? raw.quantity
      : null;

  const description =
    clean(raw.description, 200) ?? clean(text, 200) ?? "Gasto pelo WhatsApp";

  const missing: ExtractedExpense["missing"] = [];
  if (amountCents === null) missing.push("amount");
  if (stageId === null && context.stages.length) missing.push("stage");

  return {
    amountCents,
    description: capitalize(description),
    stageId,
    categoryCode: raw.category_code ?? "outros",
    supplierName: clean(raw.supplier_name, 120),
    spentOn,
    paymentMethod: raw.payment_method,
    hasInvoice: raw.has_invoice,
    quantity,
    unit: quantity !== null ? clean(raw.unit, 20) : null,
    confidence: Math.min(1, Math.max(0, raw.confidence || 0)),
    missing,
  };
}

/**
 * Chama a IA. Não conta uso nem checa limite: isso é de quem chama, que sabe
 * de qual organização é a mensagem (canCallAi em limits.ts antes, recordUsage
 * em billing/usage.ts depois, com o uso devolvido aqui).
 */
export async function extractExpense(
  text: string,
  context: ExtractionContext,
): Promise<ExtractionResult> {
  const result = await parseStructured(anthropic(), {
    model: extractionModel(),
    // Espaço para o raciocínio (o Haiku pensa por padrão) e a resposta.
    maxTokens: 2048,
    system: EXTRACT_EXPENSE_SYSTEM,
    content: buildUserMessage(text, context),
    schema: aiExpenseSchema,
    label: "extração",
  });
  if (!result.ok) {
    return { kind: "failed", reason: result.reason, usage: result.usage };
  }
  if (result.data.intent === "question") {
    return { kind: "question", usage: result.usage };
  }
  const expense = interpretAiExpense(result.data, text, context);
  return expense
    ? { kind: "expense", expense, usage: result.usage }
    : { kind: "not_expense", usage: result.usage };
}
