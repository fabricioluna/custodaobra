"use client";

import { Calculator } from "lucide-react";
import { useActionState, useId, useState } from "react";

import { fieldA11y, FormField } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents, formatQuantity, parseQuantity } from "@/lib/money";

import type { StagePlanFormState } from "../actions";
import { distributeEstimate, estimateTotalCents } from "../budget";
import { stagesCopy } from "../copy";
import { BUDGET_PREFIX } from "../schemas";

const copy = stagesCopy.budget;

export type BudgetStage = {
  id: string;
  name: string;
  budgetCents: number | null;
  defaultPercent: number | null;
};

export function BudgetForm({
  stages,
  areaM2,
  costPerM2Cents,
  action,
}: {
  stages: BudgetStage[];
  areaM2: number | null;
  costPerM2Cents: number | null;
  action: (
    prev: StagePlanFormState,
    formData: FormData,
  ) => Promise<StagePlanFormState>;
}) {
  const [state, formAction, pending] = useActionState<
    StagePlanFormState,
    FormData
  >(action, { status: "idle" });
  const id = useId();

  const [budgets, setBudgets] = useState<Record<string, number>>(() =>
    Object.fromEntries(stages.map((s) => [s.id, s.budgetCents ?? 0])),
  );
  const [area, setArea] = useState(areaM2 ? formatQuantity(areaM2) : "");
  const [cost, setCost] = useState(costPerM2Cents ?? 0);
  const [applied, setApplied] = useState(false);

  const areaValue = parseQuantity(area);
  const estimate =
    areaValue && cost > 0 ? estimateTotalCents(areaValue, cost) : null;
  const total = Object.values(budgets).reduce((sum, v) => sum + v, 0);
  const hasCustomStages = stages.some((s) => s.defaultPercent === null);

  function applyEstimate() {
    if (!estimate) return;
    const filled = Object.values(budgets).some((value) => value > 0);
    if (filled && !window.confirm(copy.confirmOverwrite)) return;
    const shares = distributeEstimate(estimate, stages);
    setBudgets((current) => {
      const next = { ...current };
      for (const [stageId, cents] of shares) {
        if (cents !== null) next[stageId] = cents;
      }
      return next;
    });
    setApplied(true);
  }

  const areaError =
    state.status === "error" ? state.fieldErrors?.area : undefined;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <section className="rounded-2xl border bg-card p-4 md:p-5">
        <h2 className="text-lg heading">{copy.estimateTitle}</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          {copy.estimateDescription}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id={`${id}-area`} label={copy.areaLabel} error={areaError}>
            <Input
              {...fieldA11y(`${id}-area`, undefined, areaError)}
              name="estimate_area"
              inputMode="decimal"
              autoComplete="off"
              placeholder="120"
              value={area}
              onChange={(event) => setArea(event.target.value)}
            />
          </FormField>
          <FormField
            id={`${id}-cost`}
            label={copy.costLabel}
            hint={copy.costHint}
          >
            <MoneyInput
              {...fieldA11y(`${id}-cost`, copy.costHint)}
              name="estimate_cost"
              cents={cost}
              onCentsChange={setCost}
            />
          </FormField>
        </div>
        <input
          type="hidden"
          name="estimate_applied"
          value={applied ? "1" : ""}
        />
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded-xl"
            disabled={!estimate}
            onClick={applyEstimate}
          >
            <Calculator aria-hidden />
            {copy.apply}
          </Button>
          {estimate ? (
            <p className="font-semibold money">
              {copy.estimateTotal(formatCents(estimate))}
            </p>
          ) : null}
        </div>
        {applied ? (
          <p role="status" className="mt-3 text-sm text-status-ok">
            {copy.estimateApplied}
          </p>
        ) : null}
        {hasCustomStages ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {copy.noPercentNote}
          </p>
        ) : null}
      </section>

      <ol className="flex flex-col divide-y rounded-2xl border bg-card">
        {stages.map((stage) => {
          const fieldId = `${id}-${stage.id}`;
          return (
            <li
              key={stage.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <label htmlFor={fieldId} className="font-medium">
                {stage.name}
              </label>
              <MoneyInput
                id={fieldId}
                aria-label={copy.stageLabel(stage.name)}
                name={`${BUDGET_PREFIX}${stage.id}`}
                cents={budgets[stage.id] ?? 0}
                onCentsChange={(cents) =>
                  setBudgets((current) => ({ ...current, [stage.id]: cents }))
                }
                className="sm:max-w-48"
              />
            </li>
          );
        })}
      </ol>

      <div className="flex items-baseline justify-between gap-3 px-1">
        <span className="text-muted-foreground">{copy.total}</span>
        <span className="text-2xl font-extrabold money">
          {formatCents(total)}
        </span>
      </div>

      {state.status === "error" && state.message ? (
        <FormMessage>{state.message}</FormMessage>
      ) : null}
      {state.status === "success" && state.message ? (
        <FormMessage tone="success">{state.message}</FormMessage>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="self-start rounded-xl"
      >
        {pending ? copy.saving : copy.save}
      </Button>
    </form>
  );
}
