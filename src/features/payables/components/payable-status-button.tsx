"use client";

import { RotateCcw, XCircle } from "lucide-react";
import { useActionState } from "react";

import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";

import type { PayableActionState } from "../actions";
import { payablesCopy } from "../copy";

const copy = payablesCopy.edit;

/** Cancelar (com confirmação) ou reabrir uma conta cancelada. */
export function PayableStatusButton({
  action,
  mode,
}: {
  action: () => Promise<PayableActionState>;
  mode: "cancel" | "reopen";
}) {
  const [state, formAction, pending] = useActionState<PayableActionState>(
    action,
    { status: "idle" },
  );
  const cancel = mode === "cancel";
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (cancel && !window.confirm(copy.confirmCancel)) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-3"
    >
      {state.status === "error" && state.message ? (
        <FormMessage>{state.message}</FormMessage>
      ) : null}
      <Button
        type="submit"
        variant={cancel ? "destructive" : "outline"}
        size="lg"
        disabled={pending}
        className="self-start rounded-xl"
      >
        {cancel ? <XCircle aria-hidden /> : <RotateCcw aria-hidden />}
        {cancel
          ? pending
            ? copy.cancelling
            : copy.cancel
          : pending
            ? copy.reopening
            : copy.reopen}
      </Button>
    </form>
  );
}
