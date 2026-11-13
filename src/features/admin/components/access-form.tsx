"use client";

import { startTransition, useActionState } from "react";

import { FormField, fieldA11y } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

import type { AccessMode } from "../access";
import { type AccessFormState, setOrgAccess } from "../actions";
import { adminCopy } from "../copy";

const copy = adminCopy.access;
const initial: AccessFormState = { status: "idle" };
const MODES: AccessMode[] = ["normal", "free", "blocked"];

export function AccessForm({
  orgId,
  mode,
  date,
  note,
  planName,
  plans,
}: {
  orgId: string;
  mode: AccessMode;
  date: string;
  note: string;
  planName: string;
  plans: { code: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(
    setOrgAccess.bind(null, orgId),
    initial,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const message = state.status === "error" ? state.message : undefined;

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
        <legend className="mb-3 font-medium">{copy.mode}</legend>
        {MODES.map((value) => (
          <label
            key={value}
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border bg-card p-4",
              "has-[:checked]:border-brand-navy has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
            )}
          >
            <input
              type="radio"
              name="mode"
              value={value}
              defaultChecked={value === mode}
              required
              className="mt-1 size-5 accent-brand-navy"
            />
            <span className="flex flex-col">
              <span className="font-semibold">{copy.modes[value].label}</span>
              <span className="text-sm text-muted-foreground">
                {copy.modes[value].hint}
              </span>
            </span>
          </label>
        ))}
        {fieldErrors?.mode ? (
          <p className="text-sm text-status-danger">{fieldErrors.mode}</p>
        ) : null}
      </fieldset>

      <FormField
        id="date"
        label={copy.date}
        optional={copy.optional}
        hint={copy.dateHint}
        error={fieldErrors?.date}
      >
        <Input
          name="date"
          type="date"
          defaultValue={date}
          {...fieldA11y("date", copy.dateHint, fieldErrors?.date)}
        />
      </FormField>

      <FormField
        id="planCode"
        label={copy.planField}
        hint={copy.planHint}
        error={fieldErrors?.planCode}
      >
        <NativeSelect
          name="planCode"
          defaultValue=""
          {...fieldA11y("planCode", copy.planHint, fieldErrors?.planCode)}
        >
          <option value="">{copy.keepPlan(planName)}</option>
          {plans.map((plan) => (
            <option key={plan.code} value={plan.code}>
              {plan.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <FormField
        id="note"
        label={copy.note}
        optional={copy.optional}
        hint={copy.noteHint}
        error={fieldErrors?.note}
      >
        <Input
          name="note"
          defaultValue={note}
          maxLength={500}
          autoComplete="off"
          {...fieldA11y("note", copy.noteHint, fieldErrors?.note)}
        />
      </FormField>

      {message ? (
        <p role="alert" className="text-status-danger">
          {message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? copy.pending : copy.submit}
      </Button>
    </form>
  );
}
