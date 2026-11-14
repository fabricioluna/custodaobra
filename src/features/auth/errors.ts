import { authCopy } from "./copy";

const { errors } = authCopy;

/** O que interessa de um erro do Supabase Auth (AuthError). */
export type AuthErrorLike = { code?: string; status?: number } | null;

/**
 * Mensagem para a pessoa a partir do erro do Supabase Auth. `fallback` é a
 * mensagem do caso comum de cada tela (senha errada, código errado...).
 */
export function authErrorMessage(
  error: AuthErrorLike,
  fallback: string = errors.generic,
): string {
  if (!error) return fallback;
  if (error.status === 429 || error.code?.startsWith("over_")) {
    return errors.rateLimited;
  }
  switch (error.code) {
    case "invalid_credentials":
      return errors.wrongPassword;
    case "weak_password":
      return errors.weakPassword;
    case "same_password":
      return errors.samePassword;
    case "user_already_exists":
    case "email_exists":
      return errors.accountExists;
    case "otp_expired":
      return errors.wrongCode;
    case "reauthentication_needed":
    case "reauthentication_not_valid":
      return errors.reauthenticate;
    case "email_address_invalid":
      return errors.invalidEmail;
    default:
      return fallback;
  }
}
