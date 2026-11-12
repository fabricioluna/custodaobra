"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";

import { FormField, fieldA11y } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { deleteAccount, type DeleteAccountState } from "../actions";
import { accountCopy } from "../copy";

const copy = accountCopy.deleteSection;
const initial: DeleteAccountState = { error: null };

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, initial);
  const error = state.error ?? undefined;
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormField id="confirm" label={copy.confirmLabel} error={error}>
        <Input
          name="confirm"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          {...fieldA11y("confirm", undefined, error)}
        />
      </FormField>
      <Button
        type="submit"
        variant="destructive"
        size="lg"
        disabled={pending}
        className="self-start"
      >
        <Trash2 aria-hidden />
        {pending ? copy.pending : copy.button}
      </Button>
    </form>
  );
}
