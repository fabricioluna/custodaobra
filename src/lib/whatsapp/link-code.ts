import { createHmac, randomInt } from "node:crypto";

/**
 * Código de 6 dígitos para ligar o número. São só 1 milhão de combinações,
 * então: vale 15 minutos, o bot limita as tentativas erradas por número e o
 * banco guarda o HMAC com uma chave do servidor (WHATSAPP_LINK_CODE_SECRET),
 * não o código nem um hash simples que daria para reverter.
 */

export const LINK_CODE_TTL_MINUTES = 15;
/** Tentativas erradas por número, por hora. */
export const MAX_LINK_ATTEMPTS_PER_HOUR = 5;

export function generateLinkCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashLinkCode(code: string, secret: string): string {
  if (!secret) throw new Error("Chave do código de vínculo ausente.");
  return createHmac("sha256", secret).update(code, "utf8").digest("hex");
}

/** "VINCULAR 123456" (com folga para maiúsculas, espaços e pontuação). */
const LINK_MESSAGE =
  /^\s*\*?vincular\*?\s*:?\s*(\d{3})[\s.-]?(\d{3})\s*\.?\s*$/i;

export function parseLinkMessage(text: string): string | null {
  const match = LINK_MESSAGE.exec(text);
  return match ? `${match[1]}${match[2]}` : null;
}

/** Começa com "vincular", mas sem um código válido. */
export function looksLikeLinkAttempt(text: string): boolean {
  return /^\s*\*?vincular\b/i.test(text);
}

/** Texto já preenchido no link wa.me. */
export function linkMessage(code: string): string {
  return `VINCULAR ${code}`;
}
