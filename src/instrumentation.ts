import * as Sentry from "@sentry/nextjs";

export async function register() {
  // Só o runtime Node.js: nenhuma rota usa o Edge, e o proxy do Next 16 roda
  // em Node.js.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

/** Erros não tratados no servidor (páginas, server actions, rotas). */
export const onRequestError = Sentry.captureRequestError;
