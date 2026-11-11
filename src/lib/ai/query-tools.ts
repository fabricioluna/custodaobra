import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { isIsoDate } from "@/lib/dates";

import {
  CATEGORY_CODES,
  type CategoryCode,
  type ExtractionContext,
  PAYMENT_METHODS,
  type PaymentMethod,
  weekdayOf,
} from "./extract-expense";

/**
 * Funções de consulta que a IA pode escolher para responder uma pergunta
 * (CLAUDE.md, seção 6). Aqui ficam só a definição das ferramentas e a
 * conferência do que a IA pediu; quem consulta o banco é
 * src/lib/whatsapp/queries.ts.
 *
 * Como na extração, a etapa vem pelo número da lista e o código converte.
 */

const nullableText = z.string().nullable();

/** Filtros comuns às consultas de gastos. */
const filterFields = {
  from: nullableText.describe("Início do período (AAAA-MM-DD), ou nulo."),
  to: nullableText.describe("Fim do período (AAAA-MM-DD), ou nulo."),
  stage_number: z
    .number()
    .nullable()
    .describe("Número da etapa na lista enviada, ou nulo."),
  category_code: z.enum(CATEGORY_CODES).nullable(),
  supplier: nullableText.describe("Nome do fornecedor, ou nulo."),
  search: nullableText.describe(
    "Palavra procurada na descrição do gasto (ex.: cimento), ou nulo.",
  ),
  payment_method: z.enum(PAYMENT_METHODS).nullable(),
};

const GROUP_BY = ["stage", "category", "supplier", "month"] as const;
const PAYABLE_STATUS = ["overdue", "upcoming", "open", "paid"] as const;
const EXPENSE_VIEWS = ["total", "by_group", "list"] as const;

/**
 * Total, divisão e lista de gastos são uma ferramenta só (`expenses`, com
 * `view`): o modo strict aceita no máximo 16 parâmetros que podem ser nulos
 * somando todas as ferramentas, e os filtros repetidos em três passariam
 * disso. Por dentro, viram as três consultas (QueryCall).
 */
export const QUERY_SCHEMAS = {
  expenses: z.object({
    view: z.enum(EXPENSE_VIEWS),
    ...filterFields,
    group_by: z
      .enum(GROUP_BY)
      .nullable()
      .describe('Com view = "by_group": como dividir.'),
    limit: z
      .number()
      .nullable()
      .describe('Com view = "list": quantos gastos, de 1 a 10.'),
  }),
  budget_status: z.object({
    stage_number: z
      .number()
      .nullable()
      .describe("Número da etapa na lista enviada, ou nulo para a obra toda."),
  }),
  payables: z.object({
    status: z.enum(PAYABLE_STATUS),
    from: nullableText.describe("Vencimento a partir de (AAAA-MM-DD)."),
    to: nullableText.describe("Vencimento até (AAAA-MM-DD)."),
  }),
};

export type QueryName = keyof typeof QUERY_SCHEMAS;

const DESCRIPTIONS: Record<QueryName, string> = {
  expenses:
    'Gastos confirmados da obra, com filtros opcionais de período, etapa, categoria, fornecedor, palavra da descrição e forma de pagamento. view = "total" (quanto foi gasto), "by_group" (dividido por etapa, categoria, fornecedor ou mês) ou "list" (os gastos mais recentes).',
  budget_status:
    "Previsto x gasto x contas a pagar por etapa, da obra toda ou de uma etapa.",
  payables:
    "Contas a pagar da obra: atrasadas, a vencer, todas em aberto ou já pagas, com filtro opcional de vencimento.",
};

/** JSON Schema da ferramenta, no formato aceito pelo modo strict. */
function inputSchema(schema: z.ZodType): Anthropic.Tool.InputSchema {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json as Anthropic.Tool.InputSchema;
}

export const QUERY_TOOLS: Anthropic.Tool[] = (
  Object.keys(QUERY_SCHEMAS) as QueryName[]
).map((name) => ({
  name,
  description: DESCRIPTIONS[name],
  input_schema: inputSchema(QUERY_SCHEMAS[name]),
  strict: true,
}));

// O que o código consulta, já conferido -------------------------------------------

export type ExpenseFilters = {
  from: string | null;
  to: string | null;
  stageId: string | null;
  categoryCode: CategoryCode | null;
  supplier: string | null;
  search: string | null;
  paymentMethod: PaymentMethod | null;
};

export type GroupBy = (typeof GROUP_BY)[number];
export type PayableStatus = (typeof PAYABLE_STATUS)[number];

export type QueryCall =
  | { name: "total_spent"; filters: ExpenseFilters }
  | { name: "spending_breakdown"; filters: ExpenseFilters; groupBy: GroupBy }
  | { name: "recent_expenses"; filters: ExpenseFilters; limit: number }
  | { name: "budget_status"; stageId: string | null }
  | {
      name: "payables";
      status: PayableStatus;
      from: string | null;
      to: string | null;
    };

/** No máximo 3 consultas por pergunta (o prompt pede de 1 a 3). */
export const MAX_QUERIES = 3;
export const DEFAULT_LIST_LIMIT = 5;
export const MAX_LIST_LIMIT = 10;

const clean = (value: string | null): string | null => {
  const text = value?.replace(/\s+/g, " ").trim().slice(0, 60);
  return text ? text : null;
};

/** Etapa pelo número da lista; número fora da lista invalida a chamada. */
function stageFrom(
  stageNumber: number | null,
  context: ExtractionContext,
): { ok: true; stageId: string | null } | { ok: false } {
  if (stageNumber === null) return { ok: true, stageId: null };
  const stage = Number.isInteger(stageNumber)
    ? context.stages[stageNumber - 1]
    : undefined;
  return stage ? { ok: true, stageId: stage.id } : { ok: false };
}

/** Período conferido; data inválida invalida a chamada. Fora de ordem, troca. */
function periodFrom(
  from: string | null,
  to: string | null,
): { from: string | null; to: string | null } | null {
  const start = clean(from);
  const end = clean(to);
  if ((start && !isIsoDate(start)) || (end && !isIsoDate(end))) return null;
  if (start && end && start > end) return { from: end, to: start };
  return { from: start, to: end };
}

function filtersFrom(
  raw: z.infer<typeof QUERY_SCHEMAS.expenses>,
  context: ExtractionContext,
): ExpenseFilters | null {
  const stage = stageFrom(raw.stage_number, context);
  const period = periodFrom(raw.from, raw.to);
  if (!stage.ok || !period) return null;
  return {
    ...period,
    stageId: stage.stageId,
    categoryCode: raw.category_code,
    supplier: clean(raw.supplier),
    search: clean(raw.search),
    paymentMethod: raw.payment_method,
  };
}

/**
 * Confere cada chamada da IA (formato pelo Zod, etapa da lista, datas
 * válidas) e devolve o que o código vai consultar. Chamada que não passa é
 * descartada. Pura, para testar sem chamar a API.
 */
export function interpretToolCalls(
  blocks: { name: string; input: unknown }[],
  context: ExtractionContext,
): QueryCall[] {
  const calls: QueryCall[] = [];
  for (const block of blocks) {
    if (calls.length >= MAX_QUERIES) break;
    const call = interpretOne(block, context);
    if (call) calls.push(call);
  }
  return calls;
}

function interpretOne(
  block: { name: string; input: unknown },
  context: ExtractionContext,
): QueryCall | null {
  switch (block.name) {
    case "expenses": {
      const raw = QUERY_SCHEMAS.expenses.safeParse(block.input);
      const filters = raw.success ? filtersFrom(raw.data, context) : null;
      if (!raw.success || !filters) return null;
      const { view, group_by, limit } = raw.data;
      if (view === "total") return { name: "total_spent", filters };
      if (view === "by_group") {
        // Sem dizer como dividir: por etapa ("onde gastei mais?").
        return {
          name: "spending_breakdown",
          filters,
          groupBy: group_by ?? "stage",
        };
      }
      return {
        name: "recent_expenses",
        filters,
        limit:
          limit === null || !Number.isFinite(limit)
            ? DEFAULT_LIST_LIMIT
            : Math.min(MAX_LIST_LIMIT, Math.max(1, Math.round(limit))),
      };
    }
    case "budget_status": {
      const raw = QUERY_SCHEMAS.budget_status.safeParse(block.input);
      const stage = raw.success
        ? stageFrom(raw.data.stage_number, context)
        : null;
      return stage?.ok
        ? { name: "budget_status", stageId: stage.stageId }
        : null;
    }
    case "payables": {
      const raw = QUERY_SCHEMAS.payables.safeParse(block.input);
      const period = raw.success
        ? periodFrom(raw.data.from, raw.data.to)
        : null;
      return raw.success && period
        ? { name: "payables", status: raw.data.status, ...period }
        : null;
    }
    default:
      return null;
  }
}

/** Mensagem do usuário: contexto variável + a pergunta. */
export function buildQuestionMessage(
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
    `Pergunta:\n<pergunta>\n${text.slice(0, 1000)}\n</pergunta>`,
  ].join("\n\n");
}
