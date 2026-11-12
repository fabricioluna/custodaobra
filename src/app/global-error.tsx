"use client";

import "./globals.css";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { APP_LOCALE } from "@/config/app";
import { marketingCopy } from "@/features/marketing/copy";

const copy = marketingCopy.globalError;

/**
 * Erro no layout raiz: substitui o documento inteiro (por isso tem `<html>`
 * e `<body>` próprios). Os erros das páginas já chegam ao Sentry pelo
 * `onRequestError`; este cobre o que quebra no navegador.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={APP_LOCALE}>
      <body className="flex min-h-dvh flex-col bg-brand-navy px-4 py-8 text-brand-white antialiased sm:px-10">
        <main className="flex max-w-xl flex-1 flex-col justify-center gap-6 py-16">
          <h1 className="text-4xl font-extrabold">{copy.title}</h1>
          <p className="text-lg text-brand-white/80">{copy.description}</p>
          <button
            type="button"
            onClick={() => retry()}
            className="min-h-11 self-start rounded-xl bg-brand-gold px-6 font-semibold text-brand-navy"
          >
            {copy.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
