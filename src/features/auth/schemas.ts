import { z } from "zod";

import { authCopy } from "./copy";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: authCopy.errors.invalidEmail }));

/** Código do e-mail: só dígitos, aceitando espaços que a pessoa digitar. */
export const otpSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{6,8}$/, { error: authCopy.errors.invalidCode }));

export const sendCodeSchema = z.object({
  email: emailSchema,
  next: z.string().optional(),
});

export const verifyCodeSchema = z.object({
  email: emailSchema,
  token: otpSchema,
  next: z.string().optional(),
});
