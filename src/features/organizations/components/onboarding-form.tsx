"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { completeOnboarding, type OnboardingState } from "../actions";
import { organizationsCopy } from "../copy";

const copy = organizationsCopy.onboarding;

/**
 * Nome da pessoa e nome da conta. Enquanto a pessoa não mexer no nome da
 * conta, ele acompanha o que ela digita no próprio nome.
 */
export function OnboardingForm({
  defaultFullName,
  defaultAccountName,
}: {
  defaultFullName: string;
  defaultAccountName: string;
}) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    { status: "idle" },
  );
  const [fullName, setFullName] = useState(defaultFullName);
  const [accountName, setAccountName] = useState(defaultAccountName);
  const [accountTouched, setAccountTouched] = useState(
    defaultAccountName !== "" && defaultAccountName !== defaultFullName,
  );

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2.5">
        <Label htmlFor="fullName">{copy.fullNameLabel}</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          autoCapitalize="words"
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value);
            if (!accountTouched) setAccountName(event.target.value);
          }}
          required
          maxLength={120}
          aria-invalid={fieldErrors?.fullName ? true : undefined}
          aria-describedby={
            fieldErrors?.fullName ? "fullName-error" : undefined
          }
        />
        {fieldErrors?.fullName ? (
          <p id="fullName-error" className="text-sm text-status-danger">
            {fieldErrors.fullName}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5">
        <Label htmlFor="accountName">{copy.accountNameLabel}</Label>
        <Input
          id="accountName"
          name="accountName"
          autoComplete="organization"
          autoCapitalize="words"
          value={accountName}
          onChange={(event) => {
            setAccountName(event.target.value);
            setAccountTouched(true);
          }}
          required
          maxLength={80}
          aria-invalid={fieldErrors?.accountName ? true : undefined}
          aria-describedby={
            fieldErrors?.accountName
              ? "accountName-hint accountName-error"
              : "accountName-hint"
          }
        />
        <p id="accountName-hint" className="text-sm text-muted-foreground">
          {copy.accountNameHint}
        </p>
        {fieldErrors?.accountName ? (
          <p id="accountName-error" className="text-sm text-status-danger">
            {fieldErrors.accountName}
          </p>
        ) : null}
      </div>

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
        {pending ? copy.submitting : copy.submit}
      </Button>
    </form>
  );
}
