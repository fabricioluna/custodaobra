"use client";

import { MessageCircle, RefreshCw } from "lucide-react";
import { useActionState, useTransition, useState } from "react";

import { FormMessage } from "@/components/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { LinkCodeState } from "../actions";
import { whatsappCopy as copy } from "../copy";

const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Ligar o número: gera o código, abre o WhatsApp com "VINCULAR 123456" pronto
 * e, depois de enviado, "Já enviei" recarrega a tela para ver se ligou.
 */
export function ConnectWhatsapp({
  createCode,
  refresh,
  botLabel,
  label = copy.connect,
  variant = "default",
}: {
  createCode: () => Promise<LinkCodeState>;
  refresh: () => Promise<void>;
  /** Número do bot formatado para mostrar (nulo se não configurado). */
  botLabel: string | null;
  label?: string;
  variant?: "default" | "outline";
}) {
  const [state, formAction, pending] = useActionState<LinkCodeState>(
    createCode,
    { status: "idle" },
  );
  const [checking, startCheck] = useTransition();
  const [checked, setChecked] = useState(0);

  if (state.status !== "success") {
    return (
      <form action={formAction} className="flex flex-col items-start gap-3">
        {state.status === "error" ? (
          <FormMessage>{state.message}</FormMessage>
        ) : null}
        <Button
          type="submit"
          size="lg"
          variant={variant}
          disabled={pending}
          className="h-13 rounded-xl text-base"
        >
          <MessageCircle aria-hidden />
          {pending ? copy.connecting : label}
        </Button>
      </form>
    );
  }

  const expires = timeFormat.format(new Date(state.expiresAt));

  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      <div>
        <h2 className="text-lg heading">{copy.codeTitle}</h2>
        <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] money">
          {state.code}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {copy.codeHint(expires)}
        </p>
      </div>

      {state.waLink ? (
        <>
          <a
            href={state.waLink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-13 self-start rounded-xl text-base",
            )}
          >
            <MessageCircle aria-hidden />
            {copy.openWhatsapp}
          </a>
          {botLabel ? (
            <p className="text-sm text-muted-foreground">
              {copy.manualSend(state.message, botLabel)}
            </p>
          ) : null}
        </>
      ) : (
        <FormMessage>{copy.noBotNumber(state.message)}</FormMessage>
      )}

      <div className="flex flex-col gap-2 border-t pt-4">
        {checked > 0 ? (
          <p className="text-sm text-muted-foreground">{copy.stillWaiting}</p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={checking}
            className="rounded-xl"
            onClick={() =>
              startCheck(async () => {
                await refresh();
                setChecked((n) => n + 1);
              })
            }
          >
            <RefreshCw aria-hidden className={cn(checking && "animate-spin")} />
            {copy.sent}
          </Button>
          <form action={formAction}>
            <Button
              type="submit"
              size="lg"
              variant="ghost"
              disabled={pending}
              className="rounded-xl"
            >
              {copy.newCode}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
