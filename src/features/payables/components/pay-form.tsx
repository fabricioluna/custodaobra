"use client";

import { startTransition, useActionState, useId, useState } from "react";

import { fieldA11y, FormField } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { expensesCopy } from "@/features/expenses/copy";
import { formatCents } from "@/lib/money";

import type { PayFormState } from "../actions";
import { payablesCopy } from "../copy";

const copy = payablesCopy.pay;

/**
 * "Marcar como paga": tudo já vem preenchido (hoje, valor da conta, boleto),
 * então um toque basta. Valor e data mudam para juros, desconto ou atraso.
 */
export function PayForm({
  action,
  defaults,
}: {
  action: (prev: PayFormState, formData: FormData) => Promise<PayFormState>;
  defaults: { paidOn: string; amountCents: number; paymentMethod: string };
}) {
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const [amountCents, setAmountCents] = useState(defaults.amountCents);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id={fid("amount")}
          label={copy.amount}
          error={errors?.amountCents}
        >
          <MoneyInput
            {...fieldA11y(fid("amount"), undefined, errors?.amountCents)}
            name="amountCents"
            cents={amountCents}
            onCentsChange={setAmountCents}
            className="text-lg font-bold"
            required
          />
        </FormField>
        <FormField
          id={fid("paidOn")}
          label={copy.paidOn}
          error={errors?.paidOn}
        >
          <Input
            {...fieldA11y(fid("paidOn"), undefined, errors?.paidOn)}
            name="paidOn"
            type="date"
            defaultValue={defaults.paidOn}
            required
          />
        </FormField>
      </div>

      <FormField
        id={fid("paymentMethod")}
        label={copy.paymentMethod}
        error={errors?.paymentMethod}
      >
        <NativeSelect
          {...fieldA11y(fid("paymentMethod"), undefined, errors?.paymentMethod)}
          name="paymentMethod"
          defaultValue={defaults.paymentMethod}
        >
          <option value="">{expensesCopy.form.paymentNone}</option>
          {Object.entries(expensesCopy.paymentMethods).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
        <input
          type="checkbox"
          name="hasInvoice"
          className="size-6 rounded accent-primary"
        />
        {copy.hasInvoice}
      </label>

      {state.status === "error" && state.message ? (
        <FormMessage>{state.message}</FormMessage>
      ) : null}

      <Button
        type="submit"
        variant="action"
        size="lg"
        disabled={pending}
        className="h-14 w-full rounded-xl text-lg sm:w-auto sm:px-10"
      >
        {pending
          ? copy.submitting
          : amountCents > 0
            ? `${copy.submit} · ${formatCents(amountCents)}`
            : copy.submit}
      </Button>
    </form>
  );
}
