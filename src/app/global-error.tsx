"use client";

import "./globals.css";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { buttonVariants } from "@/components/ui/button";
import { APP_LOCALE } from "@/config/app";
import { globalErrorCopy as copy } from "@/features/marketing/global-error-copy";
import { cn } from "@/lib/utils";

import { archivo } from "./fonts";

/**
 * Erro no layout raiz: substitui o documento inteiro (por isso tem `<html>`
 * e `<body>` próprios, com a fonte). Erro que veio do servidor chega com
 * `digest` e já foi ao Sentry pelo `onRequestError`; aqui só vai o que
 * quebrou no navegador.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    const fromServer =
      typeof error === "object" && error !== null && "digest" in error;
    if (!fromServer) Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={APP_LOCALE} className={`${archivo.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col bg-brand-navy px-4 py-8 text-brand-white sm:px-10">
        <main className="flex max-w-xl flex-1 flex-col justify-center gap-6 py-16">
          <h1 className="text-4xl heading sm:text-5xl">{copy.title}</h1>
          <p className="text-lg text-brand-white/80">{copy.description}</p>
          <button
            type="button"
            onClick={() => retry()}
            className={cn(
              buttonVariants({ variant: "action", size: "lg" }),
              "self-start",
            )}
          >
            {copy.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
