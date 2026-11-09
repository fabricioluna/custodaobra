"use client";

import { ChevronDown } from "lucide-react";
import { startTransition, useActionState, useId, useState } from "react";

import { fieldA11y, FormField } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatCents } from "@/lib/money";

import type { PayableFormState } from "../actions";
import { payablesCopy } from "../copy";
import { MAX_INSTALLMENTS, splitInstallments } from "../installments";

const copy = payablesCopy.form;

const INSTALLMENT_OPTIONS = [
  ...Array.from({ length: 24 }, (_, i) => i + 1),
  30,
  36,
  48,
  MAX_INSTALLMENTS,
];

export type PayableFormOptions = {
  stages: { id: string; name: string }[];
  categories: { id: string; code: string; name: string }[];
  suppliers: { id: string; name: string }[];
};

export type PayableFormDefaults = {
  description: string;
  amountCents: number;
  dueDate: string;
  stageId: string;
  categoryId: string;
  supplierName: string;
};

/**
 * Conta a pagar: descrição, valor, vencimento e parcelas à vista; categoria e
 * fornecedor em "Mais detalhes". Na edição (`editing`), não tem parcelas: muda
 * só a conta aberta.
 */
export function PayableForm({
  action,
  options,
  defaults,
  submitLabel,
  submittingLabel,
  editing = false,
}: {
  action: (
    prev: PayableFormState,
    formData: FormData,
  ) => Promise<PayableFormState>;
  options: PayableFormOptions;
  defaults: PayableFormDefaults;
  submitLabel: string;
  submittingLabel: string;
  editing?: boolean;
}) {
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  const [amountCents, setAmountCents] = useState(defaults.amountCents);
  const [installments, setInstallments] = useState(1);

  const preview =
    installments > 1 && amountCents >= installments
      ? installmentsPreview(amountCents, installments, defaults.dueDate)
      : null;
  const detailErrors = Boolean(errors?.categoryId || errors?.supplierName);

  return (
    <form
      onSubmit={(event) => {
        // Envio manual, para não limpar os campos quando há erro.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex max-w-xl flex-col gap-6"
      noValidate
    >
      <FormField
        id={fid("description")}
        label={copy.description}
        error={errors?.description}
      >
        <Input
          {...fieldA11y(fid("description"), undefined, errors?.description)}
          name="description"
          defaultValue={defaults.description}
          placeholder={copy.descriptionPlaceholder}
          autoCapitalize="sentences"
          autoFocus={!editing}
          maxLength={200}
          required
        />
      </FormField>

      <FormField
        id={fid("amount")}
        label={installments > 1 ? copy.amountTotal : copy.amount}
        error={errors?.amountCents}
      >
        <MoneyInput
          {...fieldA11y(fid("amount"), undefined, errors?.amountCents)}
          name="amountCents"
          cents={amountCents}
          onCentsChange={setAmountCents}
          className="h-14 text-2xl font-bold"
          required
        />
      </FormField>

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          id={fid("dueDate")}
          label={installments > 1 ? copy.firstDueDate : copy.dueDate}
          error={errors?.dueDate}
        >
          <Input
            {...fieldA11y(fid("dueDate"), undefined, errors?.dueDate)}
            name="dueDate"
            type="date"
            defaultValue={defaults.dueDate}
            required
          />
        </FormField>

        {editing ? null : (
          <FormField
            id={fid("installments")}
            label={copy.installments}
            hint={installments > 1 ? copy.installmentsHint : undefined}
            error={errors?.installments}
          >
            <NativeSelect
              {...fieldA11y(
                fid("installments"),
                installments > 1 ? copy.installmentsHint : undefined,
                errors?.installments,
              )}
              name="installments"
              value={String(installments)}
              onChange={(event) => setInstallments(Number(event.target.value))}
            >
              {INSTALLMENT_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count === 1 ? copy.single : `${count}×`}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        )}
      </div>

      {preview ? (
        <p
          className="-mt-2 rounded-xl bg-muted px-4 py-3 font-semibold money"
          aria-live="polite"
        >
          {preview}
        </p>
      ) : null}

      <FormField id={fid("stageId")} label={copy.stage} error={errors?.stageId}>
        <NativeSelect
          {...fieldA11y(fid("stageId"), undefined, errors?.stageId)}
          name="stageId"
          defaultValue={defaults.stageId}
        >
          <option value="">{copy.noStage}</option>
          {options.stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <details
        open={editing || detailErrors || undefined}
        className="group rounded-2xl border bg-card"
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
          <span className="flex flex-1 flex-col">
            <span className="font-semibold">{copy.moreDetails}</span>
            <span className="text-sm text-muted-foreground">
              {copy.moreDetailsHint}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className="size-5 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="flex flex-col gap-6 border-t px-4 pt-5 pb-6">
          <FormField
            id={fid("categoryId")}
            label={copy.category}
            error={errors?.categoryId}
          >
            <NativeSelect
              {...fieldA11y(fid("categoryId"), undefined, errors?.categoryId)}
              name="categoryId"
              defaultValue={defaults.categoryId}
            >
              {options.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <FormField
            id={fid("supplierName")}
            label={copy.supplier}
            optional={copy.optional}
            error={errors?.supplierName}
          >
            <Input
              {...fieldA11y(
                fid("supplierName"),
                undefined,
                errors?.supplierName,
              )}
              name="supplierName"
              defaultValue={defaults.supplierName}
              placeholder={copy.supplierPlaceholder}
              list={fid("supplier-options")}
              autoCapitalize="words"
              autoComplete="off"
              maxLength={120}
            />
            <datalist id={fid("supplier-options")}>
              {options.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.name} />
              ))}
            </datalist>
          </FormField>
        </div>
      </details>

      {editing ? (
        <p className="-mt-2 text-sm text-muted-foreground">
          {copy.editOneHint}
        </p>
      ) : null}

      {state.status === "error" && state.message ? (
        <FormMessage>{state.message}</FormMessage>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="h-14 w-full rounded-xl text-lg sm:w-auto sm:px-12"
      >
        {pending ? submittingLabel : submitLabel}
      </Button>
    </form>
  );
}

/** "3× de R$ 500,00" ou "1ª de R$ 333,34 e mais 2× de R$ 333,33". */
function installmentsPreview(
  totalCents: number,
  count: number,
  anyDate: string,
): string {
  const parts = splitInstallments(totalCents, count, anyDate);
  const first = parts[0].amountCents;
  const rest = parts[1].amountCents;
  return first === rest
    ? copy.installmentsPreview(count, formatCents(first))
    : copy.installmentsPreviewUneven(
        count,
        formatCents(first),
        formatCents(rest),
      );
}
