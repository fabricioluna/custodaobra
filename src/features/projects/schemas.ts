import { z } from "zod";

import { isIsoDate } from "@/lib/dates";
import { parseQuantity } from "@/lib/money";

import { BRAZIL_STATES, projectsCopy } from "./copy";

const { errors } = projectsCopy;

/** Junta espaços repetidos e tira os das pontas. */
const cleanText = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim());

/** Texto opcional: vazio vira null. */
const optionalText = (max: number, message: string) =>
  cleanText.pipe(
    z
      .string()
      .max(max, { error: message })
      .transform((value) => value || null),
  );

export const projectFormSchema = z.object({
  name: cleanText.pipe(
    z
      .string()
      .min(1, { error: errors.nameRequired })
      .max(80, { error: errors.nameTooLong }),
  ),
  address: optionalText(200, errors.addressTooLong),
  city: optionalText(80, errors.cityTooLong),
  state: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .refine(
      (value) =>
        value === "" || (BRAZIL_STATES as readonly string[]).includes(value),
      { error: errors.stateInvalid },
    )
    .transform((value) => value || null),
  builtArea: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value === "" || parseQuantity(value) !== null, {
      error: errors.areaInvalid,
    })
    .transform((value) => (value === "" ? null : parseQuantity(value))),
  standard: z
    .enum(["", "economico", "normal", "alto"])
    .transform((value) => value || null),
  startDate: z
    .string()
    .refine((value) => value === "" || isIsoDate(value), {
      error: errors.dateInvalid,
    })
    .transform((value) => value || null),
  status: z
    .enum(["planejamento", "em_andamento", "pausada", "concluida"])
    .default("em_andamento"),
});

export type ProjectFormInput = z.input<typeof projectFormSchema>;
export type ProjectFormData = z.output<typeof projectFormSchema>;
export type ProjectFormField = keyof ProjectFormInput;
