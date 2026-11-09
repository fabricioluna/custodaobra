"use client";

import { useActionState } from "react";

import { FormField, fieldA11y } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { AcceptInviteState } from "../actions";
import { membersCopy } from "../copy";

const copy = membersCopy.accept;

/** Aceitar o convite. Quem chegou agora informa só o próprio nome. */
export function AcceptInviteForm({
  action,
  askName,
  defaultName,
}: {
  action: (
    state: AcceptInviteState,
    formData: FormData,
  ) => Promise<AcceptInviteState>;
  askName: boolean;
  defaultName: string;
}) {
  const [state, formAction, pending] = useActionState<
    AcceptInviteState,
    FormData
  >(action, { status: "idle" });
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {askName ? (
        <FormField
          id="fullName"
          label={copy.nameLabel}
          hint={copy.nameHint}
          error={fieldErrors?.fullName}
        >
          <Input
            name="fullName"
            autoComplete="name"
            autoCapitalize="words"
            defaultValue={defaultName}
            required
            maxLength={120}
            {...fieldA11y("fullName", copy.nameHint, fieldErrors?.fullName)}
          />
        </FormField>
      ) : null}

      {state.status === "error" && state.message ? (
        <FormMessage>{state.message}</FormMessage>
      ) : null}

      <Button
        type="submit"
        variant="action"
        size="lg"
        disabled={pending}
        className="h-13 w-full rounded-xl text-base"
      >
        {pending ? copy.accepting : copy.accept}
      </Button>
    </form>
  );
}
