import { z } from "zod";

import { isIsoDate } from "@/lib/dates";
import { isUuid } from "@/lib/forms";
import { digitsToCents, MAX_AMOUNT_CENTS, parseQuantity } from "@/lib/money";

import { expensesCopy } from "./copy";

const { errors } = expensesCopy;

const cleanText = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim());

const optionalText = (max: number, message: string) =>
  cleanText.pipe(
    z
      .string()
      .max(max, { error: message })
      .transform((value) => value || null),
  );

/** Valor do campo Etapa quando a pessoa escolhe "+ Nova etapa". */
export const NEW_STAGE = "nova";

/** Centavos vindos de um campo estilo maquininha (só dígitos). */
const centsField = z.string().transform((value) => digitsToCents(value));

export const PAYMENT_METHODS = [
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "boleto",
  "transferencia",
  "outro",
] as const;

export const expenseFormSchema = z
  .object({
    amountCents: centsField.pipe(
      z
        .number()
        .int()
        .min(1, { error: errors.amountRequired })
        .max(MAX_AMOUNT_CENTS, { error: errors.amountTooHigh }),
    ),
    description: optionalText(200, errors.descriptionTooLong),
    stageId: z
      .string()
      .refine((value) => value === "" || value === NEW_STAGE || isUuid(value), {
        error: errors.stageInvalid,
      })
      .transform((value) => value || null),
    newStageName: optionalText(80, errors.newStageTooLong),
    categoryId: z.string().refine(isUuid, { error: errors.categoryRequired }),
    spentOn: z.string().refine(isIsoDate, { error: errors.dateInvalid }),
    supplierName: optionalText(120, errors.supplierTooLong),
    paymentMethod: z
      .enum(["", ...PAYMENT_METHODS])
      .transform((value) => value || null),
    hasInvoice: z.string().transform((value) => value === "on"),
    invoiceNumber: optionalText(60, errors.invoiceTooLong),
    quantity: z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value === "" || parseQuantity(value) !== null, {
        error: errors.quantityInvalid,
      })
      .transform((value) => (value === "" ? null : parseQuantity(value))),
    unit: optionalText(20, errors.unitTooLong),
    unitPriceCents: centsField.transform((cents) => cents || null),
  })
  .superRefine((data, ctx) => {
    if (data.stageId === NEW_STAGE && !data.newStageName) {
      ctx.addIssue({
        code: "custom",
        path: ["newStageName"],
        message: errors.newStageRequired,
      });
    }
  })
  .transform((data) => ({
    ...data,
    // Nota só faz sentido marcada; número sem nota é descartado.
    invoiceNumber: data.hasInvoice ? data.invoiceNumber : null,
    // Unidade e valor unitário só valem junto com a quantidade.
    unit: data.quantity === null ? null : data.unit,
    unitPriceCents: data.quantity === null ? null : data.unitPriceCents,
    // Nome da etapa nova só vale com "+ Nova etapa" escolhida.
    newStageName: data.stageId === NEW_STAGE ? data.newStageName : null,
  }));

export type ExpenseFormInput = z.input<typeof expenseFormSchema>;
export type ExpenseFormData = z.output<typeof expenseFormSchema>;
export type ExpenseFormField = keyof ExpenseFormInput | "receipt";

/** Filtros da lista de gastos, lidos da URL (?de=...&etapa=...). */
export const expenseFiltersSchema = z.object({
  q: z
    .string()
    .optional()
    .transform(
      (value) => value?.replace(/\s+/g, " ").trim().slice(0, 80) || null,
    ),
  de: z
    .string()
    .optional()
    .transform((value) => (value && isIsoDate(value) ? value : null)),
  ate: z
    .string()
    .optional()
    .transform((value) => (value && isIsoDate(value) ? value : null)),
  // "sem" = sem etapa (para classificar)
  etapa: z
    .string()
    .optional()
    .transform((value) => (value === "sem" || isUuid(value) ? value : null)),
  categoria: z
    .string()
    .optional()
    .transform((value) => (isUuid(value) ? value : null)),
  fornecedor: z
    .string()
    .optional()
    .transform((value) => (isUuid(value) ? value : null)),
  nota: z
    .string()
    .optional()
    .transform((value) => (value === "com" || value === "sem" ? value : null)),
});

export type ExpenseFilters = z.output<typeof expenseFiltersSchema>;

/** Lê os filtros dos searchParams da página (valores repetidos: o primeiro). */
export function parseExpenseFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ExpenseFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  return expenseFiltersSchema.parse({
    q: first(searchParams.q),
    de: first(searchParams.de),
    ate: first(searchParams.ate),
    etapa: first(searchParams.etapa),
    categoria: first(searchParams.categoria),
    fornecedor: first(searchParams.fornecedor),
    nota: first(searchParams.nota),
  });
}

/** Filtros de volta para a URL (para o link de exportar, por exemplo). */
export function filtersToSearchParams(
  filters: ExpenseFilters,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value) params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function hasActiveFilters(filters: ExpenseFilters): boolean {
  return Object.values(filters).some(Boolean);
}

/** Tipos de arquivo aceitos como comprovante. */
export const RECEIPT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

/**
 * Limite por arquivo enviado pelo app. O bucket aceita até 10 MB, mas o envio
 * passa pela server action, e a Vercel limita o corpo da requisição a 4,5 MB.
 * Fotos são reduzidas no aparelho antes de enviar, então ficam bem abaixo.
 */
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
