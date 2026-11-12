/**
 * Opções comuns do Sentry (navegador, servidor e edge). Sem DSN, o Sentry
 * fica desligado: desenvolvimento, testes e CI não mandam nada.
 *
 * O DSN é público por natureza (vai no JavaScript do navegador), por isso
 * `NEXT_PUBLIC_SENTRY_DSN`. Ele só permite enviar eventos, não ler.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryOptions = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  // "production" ou "preview" na Vercel; "development" no next dev.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  // 10% das requisições com medição de tempo: suficiente para achar lentidão
  // sem gastar a cota grátis.
  tracesSampleRate: 0.1,
  // Nada de IP, cookies ou cabeçalhos da pessoa (LGPD).
  sendDefaultPii: false,
};
