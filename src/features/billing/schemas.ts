import { z } from "zod";

import { normalizeDocument } from "@/lib/documents";

import { billingCopy } from "./copy";

const errors = billingCopy.errors;
const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

/** Plano escolhido; nome, CPF/CNPJ e e-mail só quando ainda não há cliente. */
export function parseCheckoutForm(formData: FormData, needsCustomer: boolean) {
  const base = z.object({
    planCode: z.string().regex(/^[a-z][a-z0-9_]*$/, errors.plan),
  });
  const customer = z.object({
    name: z.string().min(2, errors.name).max(120, errors.name),
    document: z.string().transform((value, ctx) => {
      const normalized = normalizeDocument(value);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: errors.document });
        return z.NEVER;
      }
      return normalized;
    }),
    email: z.email(errors.email).max(200, errors.email),
  });
  const input = {
    planCode: text(formData.get("planCode")),
    name: text(formData.get("name")),
    document: text(formData.get("document")),
    email: text(formData.get("email")),
  };
  return needsCustomer
    ? base.extend(customer.shape).safeParse(input)
    : base.safeParse(input);
}
