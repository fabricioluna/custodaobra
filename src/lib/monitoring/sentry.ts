import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/**
 * Opções comuns do Sentry (navegador e servidor). Sem DSN, o Sentry fica
 * desligado: desenvolvimento, testes e CI não mandam nada.
 *
 * O DSN é público por natureza (vai no JavaScript do navegador), por isso
 * `NEXT_PUBLIC_SENTRY_DSN`. Ele só permite enviar eventos, não ler.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

const MAX_TEXT = 300;

/**
 * Tira do texto o que identifica alguém: e-mails e sequências com 10 dígitos
 * ou mais (telefone com DDD, CPF, CNPJ, chave da NFC-e), com ou sem pontuação.
 * Datas (8 dígitos) e valores ficam. Texto longo é cortado.
 */
export function redactText(text: string): string {
  const clean = text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]")
    .replace(/\+?\d[\d.\-/() ]*\d/g, (match) =>
      match.replace(/\D/g, "").length >= 10 ? "[número]" : match,
    );
  return clean.length > MAX_TEXT ? `${clean.slice(0, MAX_TEXT)}…` : clean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resumo de um argumento do `console.error`: números e ids ficam; texto passa
 * pelo `redactText`; de objetos (erros do banco, da IA, da Meta) ficam só
 * nome, código, status e a mensagem limpa. Nunca o objeto inteiro, que pode
 * trazer a saída da IA (fornecedor, CPF/CNPJ, descrição do gasto).
 */
export function describeArg(arg: unknown): unknown {
  if (arg === null || arg === undefined) return arg;
  if (typeof arg === "number" || typeof arg === "boolean") return arg;
  if (typeof arg === "string") return UUID.test(arg) ? arg : redactText(arg);
  if (typeof arg === "object") {
    const source = arg as Record<string, unknown>;
    const summary: Record<string, unknown> = {};
    for (const key of ["name", "code", "status", "message"]) {
      const value = source[key];
      if (typeof value === "number") summary[key] = value;
      if (typeof value === "string") summary[key] = redactText(value);
    }
    return summary;
  }
  return typeof arg;
}

/**
 * Último filtro antes de mandar um evento (LGPD).
 *
 * Eventos do `console.error` (servidor): só os nossos, com prefixo entre
 * colchetes ("[whatsapp]", "[ia]"...). Os que o Next.js e o React escrevem
 * sozinhos são descartados, porque o erro já chegou pelo `onRequestError`
 * (senão viraria evento em dobro). Dos nossos, a mensagem fica só com o
 * prefixo e os outros argumentos viram o resumo do `describeArg`.
 *
 * Em todo evento, a mensagem e os textos das exceções passam pelo `redactText`.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.logger === "console") {
    const { arguments: args, ...extra } = event.extra ?? {};
    const list: unknown[] = Array.isArray(args) ? args : [];
    const prefix = typeof list[0] === "string" ? list[0] : "";
    if (!prefix.startsWith("[")) return null;
    event.extra = {
      ...extra,
      context: redactText(prefix),
      details: list.slice(1).map(describeArg),
    };
    if (event.message !== undefined) event.message = redactText(prefix);
  } else if (event.message) {
    event.message = redactText(event.message);
  }
  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = redactText(value.value);
  }
  return event;
}

/**
 * Sem a trilha do console: ela guarda os argumentos dos `console.log` e
 * `console.error`, com o mesmo risco de dados pessoais.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  return breadcrumb.category === "console" ? null : breadcrumb;
}

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
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
};
