"use client";

import { type ReactNode, useActionState } from "react";

import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

/**
 * Botão que dispara uma action sem campos (cancelar convite, tirar da
 * equipe), com confirmação opcional para não agir por um toque sem querer.
 */
export function ActionButton({
  action,
  label,
  pendingLabel,
  confirmMessage,
  icon,
  variant = "outline",
  className,
}: {
  action: () => Promise<FormState<never>>;
  label: string;
  pendingLabel: string;
  confirmMessage?: string;
  /** Elemento já pronto (ex.: <X aria-hidden />): componentes não passam do servidor para o cliente. */
  icon?: ReactNode;
  variant?: "outline" | "destructive" | "ghost";
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState<never>>(
    action,
    { status: "idle" },
  );
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      className={cn("flex flex-col items-start gap-3", className)}
    >
      {state.status === "error" && state.message ? (
        <FormMessage>{state.message}</FormMessage>
      ) : null}
      <Button
        type="submit"
        variant={variant}
        size="lg"
        disabled={pending}
        className="rounded-xl"
      >
        {icon}
        {pending ? pendingLabel : label}
      </Button>
    </form>
  );
}
