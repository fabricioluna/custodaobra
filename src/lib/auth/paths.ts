/** Caminhos do fluxo de login. Sem dependências: usado no proxy e nos testes. */

export const LOGIN_PATH = "/entrar";
/** Decide para onde a pessoa vai depois de entrar (primeiro acesso ou obras). */
export const AFTER_LOGIN_PATH = "/inicio";
export const ONBOARDING_PATH = "/primeiro-acesso";
/** Para onde vai quem acabou de excluir a conta (página pública). */
export const ACCOUNT_DELETED_PATH = "/conta-excluida";

/** Áreas que exigem login. */
const PROTECTED_PREFIXES = ["/o", AFTER_LOGIN_PATH, ONBOARDING_PATH];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Valida o destino depois do login (?next=). Aceita só caminhos internos
 * ("/o/..."), para ninguém usar o nosso login para mandar a pessoa a outro site.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return AFTER_LOGIN_PATH;
  let value: string;
  try {
    value = decodeURIComponent(raw).trim();
  } catch {
    return AFTER_LOGIN_PATH;
  }
  const isInternal =
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\") &&
    !/[\u0000-\u001f]/.test(value);
  if (!isInternal) return AFTER_LOGIN_PATH;
  if (value === LOGIN_PATH || value.startsWith(`${LOGIN_PATH}?`)) {
    return AFTER_LOGIN_PATH;
  }
  return value;
}

/** Monta /entrar?next=... a partir do caminho que a pessoa tentou abrir. */
export function loginPathFor(pathWithSearch: string): string {
  const next = safeNextPath(pathWithSearch);
  if (next === AFTER_LOGIN_PATH) return LOGIN_PATH;
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}
