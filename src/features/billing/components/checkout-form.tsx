"use client";

import { startTransition, useActionState } from "react";

import { FormField, fieldA11y } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import { type BillingFormState, startCheckout } from "../actions";
import { billingCopy } from "../copy";

const copy = billingCopy.subscribe;
const initial: BillingFormState = { status: "idle" };

type Plan = {
  code: string;
  name: string;
  price_cents_month: number;
  max_projects: number;
  max_members: number;
};

export function CheckoutForm({
  orgSlug,
  plans,
  currentPlan,
  needsCustomer,
  defaultName,
  defaultEmail,
}: {
  orgSlug: string;
  plans: Plan[];
  currentPlan: string | null;
  needsCustomer: boolean;
  defaultName: string;
  defaultEmail: string;
}) {
  const [state, action, pending] = useActionState(
    startCheckout.bind(null, orgSlug),
    initial,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const message = state.status === "error" ? state.message : undefined;
  // O plano atual, se for um dos pagos; senão, o primeiro.
  const selected = plans.some((p) => p.code === currentPlan)
    ? currentPlan
    : plans[0]?.code;

  return (
    <form
      // Sem `action`: o React limparia o que foi digitado quando há erro.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
      className="flex flex-col gap-6"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-medium">{copy.plan}</legend>
        {plans.map((plan) => (
          <label
            key={plan.code}
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border bg-card p-4",
              "has-[:checked]:border-brand-navy has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
            )}
          >
            <input
              type="radio"
              name="planCode"
              value={plan.code}
              defaultChecked={plan.code === selected}
              required
              className="mt-1 size-5 accent-brand-navy"
            />
            <span className="flex flex-col">
              <span className="font-semibold">{plan.name}</span>
              <span className="money">
                {formatCents(plan.price_cents_month)}
                {billingCopy.page.perMonth}
              </span>
            </span>
          </label>
        ))}
        {fieldErrors?.planCode ? (
          <p className="text-sm text-status-danger">{fieldErrors.planCode}</p>
        ) : null}
      </fieldset>

      {needsCustomer ? (
        <>
          <FormField
            id="name"
            label={copy.name}
            hint={copy.nameHint}
            error={fieldErrors?.name}
          >
            <Input
              name="name"
              defaultValue={defaultName}
              autoComplete="name"
              required
              {...fieldA11y("name", copy.nameHint, fieldErrors?.name)}
            />
          </FormField>
          <FormField
            id="document"
            label={copy.document}
            hint={copy.documentHint}
            error={fieldErrors?.document}
          >
            <Input
              name="document"
              autoCapitalize="characters"
              autoComplete="off"
              required
              {...fieldA11y(
                "document",
                copy.documentHint,
                fieldErrors?.document,
              )}
            />
          </FormField>
          <FormField id="email" label={copy.email} error={fieldErrors?.email}>
            <Input
              name="email"
              type="email"
              defaultValue={defaultEmail}
              autoComplete="email"
              required
              {...fieldA11y("email", undefined, fieldErrors?.email)}
            />
          </FormField>
        </>
      ) : null}

      {message ? (
        <p role="alert" className="text-status-danger">
          {message}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="action"
        size="lg"
        disabled={pending}
        className="self-start"
      >
        {pending ? copy.pending : copy.submit}
      </Button>
    </form>
  );
}
