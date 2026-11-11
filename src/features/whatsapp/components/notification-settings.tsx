"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";

import { whatsappCopy } from "../copy";

const copy = whatsappCopy.notifications;

/** Liga e desliga o aviso de orçamento e o resumo semanal. */
export function NotificationSettings({
  action,
  budgetAlerts,
  weeklyReport,
}: {
  action: (
    state: FormState<never>,
    formData: FormData,
  ) => Promise<FormState<never>>;
  budgetAlerts: boolean;
  weeklyReport: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    FormState<never>,
    FormData
  >(action, { status: "idle" });

  const options = [
    {
      name: "budgetAlerts",
      label: copy.budgetAlerts,
      hint: copy.budgetAlertsHint,
      checked: budgetAlerts,
    },
    {
      name: "weeklyReport",
      label: copy.weeklyReport,
      hint: copy.weeklyReportHint,
      checked: weeklyReport,
    },
  ];

  return (
    <section className="border-t pt-6">
      <h2 className="text-lg heading">{copy.title}</h2>
      <p className="mt-1.5 text-muted-foreground">{copy.description}</p>
      <form action={formAction} className="mt-4 flex flex-col gap-4">
        {options.map((option) => (
          <label
            key={option.name}
            className="flex min-h-11 cursor-pointer items-start gap-3"
          >
            <input
              type="checkbox"
              name={option.name}
              defaultChecked={option.checked}
              aria-describedby={`${option.name}-hint`}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span className="flex flex-col gap-1">
              <span className="font-semibold">{option.label}</span>
              <span
                id={`${option.name}-hint`}
                className="text-sm text-muted-foreground"
              >
                {option.hint}
              </span>
            </span>
          </label>
        ))}

        {state.status !== "idle" && state.message ? (
          <FormMessage tone={state.status === "error" ? "error" : "success"}>
            {state.message}
          </FormMessage>
        ) : null}

        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          className="self-start"
        >
          {pending ? copy.saving : copy.save}
        </Button>
      </form>
    </section>
  );
}
