import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Confere o cabeçalho que a Vercel Cron manda: `Authorization: Bearer
 * <CRON_SECRET>`. Sem CRON_SECRET configurado, nada passa.
 */
export function isCronAuthorized(
  authorization: string | null,
  secret: string | undefined = process.env.CRON_SECRET,
): boolean {
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  // Compara os hashes: mesmo tamanho sempre, em tempo constante.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(
    digest(authorization.slice("Bearer ".length)),
    digest(secret),
  );
}
