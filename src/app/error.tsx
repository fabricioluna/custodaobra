"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { buttonVariants } from "@/components/ui/button";
import { globalErrorCopy as copy } from "@/features/marketing/global-error-copy";
import { isStaleDeploymentError, reloadOnce } from "@/lib/stale-deploy";
import { cn } from "@/lib/utils";

/**
 * Erro numa página (abaixo do layout raiz). O caso mais comum é a página
 * aberta antes de um deploy: aí recarrega sozinha uma vez, em vez de mostrar
 * "An unexpected response was received from the server". O resto vai ao
 * Sentry (o que veio do servidor, com `digest`, já foi pelo onRequestError).
 */
export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    if (isStaleDeploymentError(error) && reloadOnce()) return;
    const fromServer =
      typeof error === "object" && error !== null && "digest" in error;
    if (!fromServer) Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col bg-background px-4 py-16 sm:px-10">
      <div className="flex max-w-xl flex-col gap-6">
        <h1 className="text-3xl heading sm:text-4xl">{copy.title}</h1>
        <p className="text-lg text-muted-foreground">{copy.description}</p>
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
      </div>
    </main>
  );
}
