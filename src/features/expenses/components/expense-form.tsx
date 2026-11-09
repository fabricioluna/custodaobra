"use client";

import { ChevronDown, Paperclip } from "lucide-react";
import { startTransition, useActionState, useMemo, useState } from "react";

import { fieldA11y, FormField } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { shrinkImage } from "@/lib/image";
import { formatCents, multiplyCents, parseQuantity } from "@/lib/money";

import type { ExpenseFormState } from "../actions";
import { expensesCopy } from "../copy";
import { guessCategoryCode } from "../guess-category";
import { MAX_RECEIPT_BYTES, RECEIPT_MIME_TYPES } from "../schemas";

const copy = expensesCopy.form;

export type ExpenseFormOptions = {
  stages: { id: string; name: string }[];
  categories: { id: string; code: string; name: string }[];
  suppliers: { id: string; name: string }[];
};

export type ExpenseFormDefaults = {
  amountCents: number;
  description: string;
  stageId: string;
  categoryId: string;
  spentOn: string;
  supplierName: string;
  paymentMethod: string;
  hasInvoice: boolean;
  invoiceNumber: string;
  quantity: string;
  unit: string;
  unitPriceCents: number;
};

/**
 * Formulário curto de lançamento: valor, descrição e etapa à vista; o resto
 * em "Mais detalhes". Feito para levar menos de 10 segundos no celular.
 */
export function ExpenseForm({
  action,
  options,
  defaults,
  submitLabel,
  submittingLabel,
  detailsOpen = false,
}: {
  action: (
    prev: ExpenseFormState,
    formData: FormData,
  ) => Promise<ExpenseFormState>;
  options: ExpenseFormOptions;
  defaults: ExpenseFormDefaults;
  submitLabel: string;
  submittingLabel: string;
  detailsOpen?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  const [amountCents, setAmountCents] = useState(defaults.amountCents);
  const [categoryId, setCategoryId] = useState(defaults.categoryId);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [hasInvoice, setHasInvoice] = useState(defaults.hasInvoice);
  const [quantity, setQuantity] = useState(defaults.quantity);
  const [unitPriceCents, setUnitPriceCents] = useState(defaults.unitPriceCents);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const categoryIdByCode = useMemo(
    () => new Map(options.categories.map((c) => [c.code, c.id])),
    [options.categories],
  );

  // Quantidade × valor unitário preenche o total.
  function updateTotal(nextQuantity: string, nextUnitPrice: number) {
    const parsed = parseQuantity(nextQuantity);
    if (parsed !== null && nextUnitPrice > 0) {
      setAmountCents(multiplyCents(nextUnitPrice, parsed));
    }
  }

  async function handleReceiptChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const input = event.target;
    const original = input.files?.[0];
    setReceiptError(null);
    if (!original) return;
    if (!(RECEIPT_MIME_TYPES as readonly string[]).includes(original.type)) {
      setReceiptError(expensesCopy.errors.receiptType);
      input.value = "";
      return;
    }
    setReceiptBusy(true);
    const file = await shrinkImage(original);
    setReceiptBusy(false);
    if (file.size > MAX_RECEIPT_BYTES) {
      setReceiptError(expensesCopy.errors.receiptTooBig);
      input.value = "";
      return;
    }
    if (file !== original) {
      try {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
      } catch {
        // Navegador sem DataTransfer: segue com o arquivo original.
      }
    }
  }

  const receiptMessage = receiptError ?? errors?.receipt;

  return (
    <form
      onSubmit={(event) => {
        // Envio manual: com `action` direto, o React limpa os campos depois do
        // envio, e a pessoa perderia o que digitou quando há erro.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex max-w-xl flex-col gap-6"
      noValidate
    >
      <FormField id="amount" label={copy.amount} error={errors?.amountCents}>
        <MoneyInput
          {...fieldA11y("amount", undefined, errors?.amountCents)}
          name="amountCents"
          cents={amountCents}
          onCentsChange={setAmountCents}
          autoFocus={defaults.amountCents === 0}
          className="h-16 text-3xl font-bold"
          required
        />
      </FormField>

      <FormField
        id="description"
        label={copy.description}
        optional={copy.optional}
        hint={copy.descriptionHint}
        error={errors?.description}
      >
        <Input
          {...fieldA11y(
            "description",
            copy.descriptionHint,
            errors?.description,
          )}
          name="description"
          defaultValue={defaults.description}
          placeholder={copy.descriptionPlaceholder}
          autoCapitalize="sentences"
          maxLength={200}
          onChange={(event) => {
            if (categoryTouched) return;
            const code = guessCategoryCode(event.target.value);
            const guessed = code ? categoryIdByCode.get(code) : undefined;
            setCategoryId(guessed ?? defaults.categoryId);
          }}
        />
      </FormField>

      <FormField id="stageId" label={copy.stage} error={errors?.stageId}>
        <NativeSelect
          {...fieldA11y("stageId", undefined, errors?.stageId)}
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
        open={detailsOpen || hasDetailErrors(errors) || undefined}
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
            id="categoryId"
            label={copy.category}
            error={errors?.categoryId}
          >
            <NativeSelect
              {...fieldA11y("categoryId", undefined, errors?.categoryId)}
              name="categoryId"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setCategoryTouched(true);
              }}
            >
              {options.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <FormField id="spentOn" label={copy.spentOn} error={errors?.spentOn}>
            <Input
              {...fieldA11y("spentOn", undefined, errors?.spentOn)}
              name="spentOn"
              type="date"
              defaultValue={defaults.spentOn}
              required
              className="max-w-56"
            />
          </FormField>

          <FormField
            id="supplierName"
            label={copy.supplier}
            optional={copy.optional}
            error={errors?.supplierName}
          >
            <Input
              {...fieldA11y("supplierName", undefined, errors?.supplierName)}
              name="supplierName"
              defaultValue={defaults.supplierName}
              placeholder={copy.supplierPlaceholder}
              list="supplier-options"
              autoCapitalize="words"
              autoComplete="off"
              maxLength={120}
            />
            <datalist id="supplier-options">
              {options.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.name} />
              ))}
            </datalist>
          </FormField>

          <FormField
            id="paymentMethod"
            label={copy.paymentMethod}
            error={errors?.paymentMethod}
          >
            <NativeSelect
              {...fieldA11y("paymentMethod", undefined, errors?.paymentMethod)}
              name="paymentMethod"
              defaultValue={defaults.paymentMethod}
            >
              <option value="">{copy.paymentNone}</option>
              {Object.entries(expensesCopy.paymentMethods).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </NativeSelect>
          </FormField>

          <div className="flex flex-col gap-3">
            <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
              <input
                type="checkbox"
                name="hasInvoice"
                checked={hasInvoice}
                onChange={(event) => setHasInvoice(event.target.checked)}
                className="size-6 rounded accent-primary"
              />
              {copy.hasInvoice}
            </label>
            {hasInvoice ? (
              <FormField
                id="invoiceNumber"
                label={copy.invoiceNumber}
                optional={copy.optional}
                error={errors?.invoiceNumber}
              >
                <Input
                  {...fieldA11y(
                    "invoiceNumber",
                    undefined,
                    errors?.invoiceNumber,
                  )}
                  name="invoiceNumber"
                  defaultValue={defaults.invoiceNumber}
                  inputMode="numeric"
                  maxLength={60}
                  className="max-w-64"
                />
              </FormField>
            ) : null}
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-base font-semibold">
              {copy.quantityTitle}
            </legend>
            <p className="-mt-1 text-sm text-muted-foreground">
              {copy.quantityHint}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                id="quantity"
                label={copy.quantity}
                error={errors?.quantity}
              >
                <Input
                  {...fieldA11y("quantity", undefined, errors?.quantity)}
                  name="quantity"
                  value={quantity}
                  inputMode="decimal"
                  onChange={(event) => {
                    setQuantity(event.target.value);
                    updateTotal(event.target.value, unitPriceCents);
                  }}
                />
              </FormField>
              <FormField id="unit" label={copy.unit} error={errors?.unit}>
                <Input
                  {...fieldA11y("unit", undefined, errors?.unit)}
                  name="unit"
                  defaultValue={defaults.unit}
                  placeholder={copy.unitPlaceholder}
                  list="unit-options"
                  autoComplete="off"
                  maxLength={20}
                />
                <datalist id="unit-options">
                  {expensesCopy.units.map((unit) => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
              </FormField>
            </div>
            <FormField
              id="unitPrice"
              label={copy.unitPrice}
              error={errors?.unitPriceCents}
            >
              <MoneyInput
                {...fieldA11y("unitPrice", undefined, errors?.unitPriceCents)}
                name="unitPriceCents"
                cents={unitPriceCents}
                onCentsChange={(cents) => {
                  setUnitPriceCents(cents);
                  updateTotal(quantity, cents);
                }}
                className="max-w-56"
              />
            </FormField>
          </fieldset>

          <FormField
            id="receipt"
            label={copy.receipt}
            optional={copy.optional}
            hint={receiptBusy ? copy.receiptProcessing : copy.receiptHint}
            error={receiptMessage}
          >
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-input bg-background px-4 py-3 text-base focus-within:ring-3 focus-within:ring-ring/30">
              <Paperclip className="size-5 text-muted-foreground" aria-hidden />
              <input
                {...fieldA11y("receipt", copy.receiptHint, receiptMessage)}
                type="file"
                name="receipt"
                accept={RECEIPT_MIME_TYPES.join(",")}
                onChange={handleReceiptChange}
                className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:font-semibold"
              />
            </label>
          </FormField>
        </div>
      </details>

      {state.status === "error" && state.message ? (
        <FormMessage>{state.message}</FormMessage>
      ) : null}

      <Button
        type="submit"
        variant="action"
        size="lg"
        disabled={pending || receiptBusy}
        className="h-14 w-full rounded-xl text-lg sm:w-auto sm:px-12"
      >
        {pending
          ? submittingLabel
          : amountCents > 0
            ? `${submitLabel} · ${formatCents(amountCents)}`
            : submitLabel}
      </Button>
    </form>
  );
}

/** Abre "Mais detalhes" se algum erro estiver escondido lá dentro. */
function hasDetailErrors(
  errors: Partial<Record<string, string>> | undefined,
): boolean {
  if (!errors) return false;
  return [
    "categoryId",
    "spentOn",
    "supplierName",
    "paymentMethod",
    "invoiceNumber",
    "quantity",
    "unit",
    "unitPriceCents",
    "receipt",
  ].some((key) => Boolean(errors[key]));
}
