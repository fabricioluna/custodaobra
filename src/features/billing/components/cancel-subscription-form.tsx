"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { type BillingFormState, cancelSubscription } from "../actions";
import { billingCopy } from "../copy";

const copy = billingCopy.subscription;
const initial: BillingFormState = { status: "idle" };

export function CancelSubscriptionForm({ orgSlug }: { orgSlug: string }) {
  const [state, action, pending] = useActionState(
    cancelSubscription.bind(null, orgSlug),
    initial,
  );
  const message = state.status === "error" ? state.message : undefined;
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name="confirm"
          required
          className="size-5 accent-brand-navy"
        />
        {copy.cancelConfirm}
      </label>
      {message ? (
        <p role="alert" className="text-status-danger">
          {message}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="destructive"
        disabled={pending}
        className="self-start"
      >
        {pending ? copy.cancelPending : copy.cancelSubmit}
      </Button>
    </form>
  );
}
