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

/**
 * Senha nova: de 6 a 72 caracteres (72 é o limite do bcrypt, que o Supabase
 * usa). O Supabase também confere o mínimo (configurado no painel).
 */
export const newPasswordSchema = z
  .string()
  .min(6, { error: authCopy.errors.shortPassword })
  .max(72, { error: authCopy.errors.longPassword });

export const passwordLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: authCopy.errors.missingPassword }),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  token: otpSchema,
  password: newPasswordSchema,
});
