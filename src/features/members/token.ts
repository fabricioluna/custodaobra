import { createHash, randomBytes } from "node:crypto";

/**
 * Token do link de convite: 32 bytes aleatórios em base64url (43 caracteres).
 * O banco guarda só o SHA-256 em hex; a função accept_invitation calcula o
 * mesmo hash do lado do Postgres.
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** Descarta antes de ir ao banco o que nem tem cara de token. */
export function isInviteTokenShape(token: string): boolean {
  return TOKEN_SHAPE.test(token);
}
