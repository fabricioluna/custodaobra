"use client";

import { useActionState, useId } from "react";

import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

import type { StagePlanFormState } from "../actions";
import { stagesCopy } from "../copy";
import { PROGRESS_PREFIX } from "../schemas";

const copy = stagesCopy.progress;
const STEPS = Array.from({ length: 11 }, (_, index) => index * 10);

export type ProgressStage = {
  id: string;
  name: string;
  progressPercent: number;
  spentPercent: number | null;
};

/** Progresso de cada etapa em passos de 10%, num select nativo (rápido no celular). */
export function ProgressForm({
  stages,
  action,
}: {
  stages: ProgressStage[];
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

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <ol className="flex flex-col divide-y rounded-2xl border bg-card">
        {stages.map((stage) => {
          const fieldId = `${id}-${stage.id}`;
          const steps = STEPS.includes(stage.progressPercent)
            ? STEPS
            : [...STEPS, stage.progressPercent].sort((a, b) => a - b);
          return (
            <li
              key={stage.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <span className="flex flex-col">
                <label htmlFor={fieldId} className="font-medium">
                  {stage.name}
                </label>
                {stage.spentPercent !== null ? (
                  <span className="text-sm text-muted-foreground">
                    {copy.spentHint(stage.spentPercent)}
                  </span>
                ) : null}
              </span>
              <div className="sm:w-32">
                <NativeSelect
                  id={fieldId}
                  aria-label={copy.stageLabel(stage.name)}
                  name={`${PROGRESS_PREFIX}${stage.id}`}
                  defaultValue={String(stage.progressPercent)}
                >
                  {steps.map((value) => (
                    <option key={value} value={value}>
                      {copy.option(value)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </li>
          );
        })}
      </ol>

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
