/**
 * Página aberta antes de um deploy: o navegador ainda tem o código antigo e,
 * ao enviar um formulário, chama uma ação do servidor que a versão nova não
 * conhece (o Next.js responde "An unexpected response was received from the
 * server") ou tenta baixar um pedaço de código que não existe mais. Recarregar
 * a página resolve.
 */
const STALE_PATTERNS = [
  /unexpected response was received from the server/i,
  /failed to find server action/i,
  /server action .* was not found/i,
  /chunkloaderror/i,
  /loading (css )?chunk .* failed/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
];

export function isStaleDeploymentError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  const text = `${typeof name === "string" ? name : ""} ${
    typeof message === "string" ? message : ""
  }`;
  return STALE_PATTERNS.some((pattern) => pattern.test(text));
}

const RELOAD_KEY = "stale-deploy-reload";
/** Não recarrega de novo dentro deste intervalo (evita ficar em ciclo). */
const RELOAD_GUARD_MS = 60_000;

/**
 * Recarrega a página uma vez. Devolve false se já recarregou há pouco (aí a
 * tela de erro aparece normalmente).
 */
export function reloadOnce(now = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (now - last < RELOAD_GUARD_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    // Sem sessionStorage não dá para evitar um ciclo: mostra o erro.
    return false;
  }
  window.location.reload();
  return true;
}
