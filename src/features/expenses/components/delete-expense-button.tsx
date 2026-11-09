"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";

import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";

import type { ExpenseFormState } from "../actions";
import { expensesCopy } from "../copy";

const copy = expensesCopy.edit;

/** Excluir (lógico) com confirmação, para não apagar por um toque sem querer. */
export function DeleteExpenseButton({
  action,
}: {
  action: () => Promise<ExpenseFormState>;
}) {
  const [state, formAction, pending] = useActionState<ExpenseFormState>(
    action,
    { status: "idle" },
  );
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(copy.confirmDelete)) event.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      {state.status === "error" && state.message ? (
        <FormMessage>{state.message}</FormMessage>
      ) : null}
      <Button
        type="submit"
        variant="destructive"
        size="lg"
        disabled={pending}
        className="self-start rounded-xl"
      >
        <Trash2 aria-hidden />
        {pending ? copy.deleting : copy.delete}
      </Button>
    </form>
  );
}
