import { z } from "zod";

import { PAYMENT_METHODS } from "@/features/expenses/schemas";
import { isIsoDate } from "@/lib/dates";
import { isUuid } from "@/lib/forms";
import { digitsToCents, MAX_AMOUNT_CENTS } from "@/lib/money";

import { payablesCopy } from "./copy";
import { MAX_INSTALLMENTS } from "./installments";

const { errors } = payablesCopy;

const cleanText = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim());

const amountField = z
  .string()
  .transform((value) => digitsToCents(value))
  .pipe(
    z
      .number()
      .int()
      .min(1, { error: errors.amountRequired })
      .max(MAX_AMOUNT_CENTS, { error: errors.amountTooHigh }),
  );

const dateField = z.string().refine(isIsoDate, { error: errors.dateInvalid });

/** Nova conta (uma ou várias parcelas) e edição de uma conta. */
export const payableFormSchema = z
  .object({
    description: cleanText.pipe(
      z
        .string()
        .min(1, { error: errors.descriptionRequired })
        .max(200, { error: errors.descriptionTooLong }),
    ),
    amountCents: amountField,
    dueDate: dateField,
    // Ausente na edição (cada parcela é editada sozinha): vale 1.
    installments: z
      .string()
      .transform((value) => (value === "" ? 1 : Number(value)))
      .pipe(
        z
          .number({ error: errors.installmentsInvalid })
          .int({ error: errors.installmentsInvalid })
          .min(1, { error: errors.installmentsInvalid })
          .max(MAX_INSTALLMENTS, { error: errors.installmentsInvalid }),
      ),
    stageId: z
      .string()
      .refine((value) => value === "" || isUuid(value), {
        error: errors.stageInvalid,
      })
      .transform((value) => value || null),
    categoryId: z.string().refine(isUuid, { error: errors.categoryRequired }),
    supplierName: cleanText.pipe(
      z
        .string()
        .max(120, { error: errors.supplierTooLong })
        .transform((value) => value || null),
    ),
  })
  .refine((data) => data.amountCents >= data.installments, {
    path: ["amountCents"],
    error: errors.amountTooLowForInstallments,
  });

export type PayableFormInput = z.input<typeof payableFormSchema>;
export type PayableFormData = z.output<typeof payableFormSchema>;
export type PayableFormField = keyof PayableFormInput;

/** "Marcar como paga": data, valor pago e forma de pagamento. */
export const payFormSchema = z.object({
  paidOn: dateField,
  amountCents: amountField,
  paymentMethod: z
    .enum(["", ...PAYMENT_METHODS])
    .transform((value) => value || null),
  hasInvoice: z.string().transform((value) => value === "on"),
});

export type PayFormInput = z.input<typeof payFormSchema>;
export type PayFormData = z.output<typeof payFormSchema>;
export type PayFormField = keyof PayFormInput;
