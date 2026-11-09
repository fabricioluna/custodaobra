"use client";

import { startTransition, useActionState } from "react";

import { fieldA11y, FormField } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

import type { ProjectFormState } from "../actions";
import { BRAZIL_STATES, projectsCopy } from "../copy";

const copy = projectsCopy.form;

export type ProjectFormDefaults = {
  name: string;
  address: string;
  city: string;
  state: string;
  builtArea: string;
  standard: string;
  startDate: string;
  status: string;
};

const EMPTY: ProjectFormDefaults = {
  name: "",
  address: "",
  city: "",
  state: "",
  builtArea: "",
  standard: "",
  startDate: "",
  status: "em_andamento",
};

/** Formulário de obra: criar (só o nome é obrigatório) ou editar. */
export function ProjectForm({
  action,
  defaults = EMPTY,
  submitLabel,
  submittingLabel,
  showStatus = false,
  disabled = false,
}: {
  action: (
    prev: ProjectFormState,
    formData: FormData,
  ) => Promise<ProjectFormState>;
  defaults?: ProjectFormDefaults;
  submitLabel: string;
  submittingLabel: string;
  showStatus?: boolean;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const errors = state.status === "error" ? state.fieldErrors : undefined;

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
      <fieldset disabled={disabled} className="flex flex-col gap-6">
        <FormField id="name" label={copy.name} error={errors?.name}>
          <Input
            {...fieldA11y("name", undefined, errors?.name)}
            name="name"
            defaultValue={defaults.name}
            placeholder={copy.namePlaceholder}
            autoCapitalize="sentences"
            maxLength={80}
            required
          />
        </FormField>

        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <FormField id="city" label={copy.city} error={errors?.city}>
            <Input
              {...fieldA11y("city", undefined, errors?.city)}
              name="city"
              defaultValue={defaults.city}
              autoComplete="address-level2"
              autoCapitalize="words"
              maxLength={80}
            />
          </FormField>
          <FormField id="state" label={copy.state} error={errors?.state}>
            <NativeSelect
              {...fieldA11y("state", undefined, errors?.state)}
              name="state"
              defaultValue={defaults.state}
              autoComplete="address-level1"
            >
              <option value="">{copy.statePlaceholder}</option>
              {BRAZIL_STATES.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>

        <FormField
          id="builtArea"
          label={copy.builtArea}
          hint={copy.builtAreaHint}
          error={errors?.builtArea}
        >
          <Input
            {...fieldA11y("builtArea", copy.builtAreaHint, errors?.builtArea)}
            name="builtArea"
            defaultValue={defaults.builtArea}
            inputMode="decimal"
            className="max-w-48"
          />
        </FormField>

        <FormField id="standard" label={copy.standard} error={errors?.standard}>
          <NativeSelect
            {...fieldA11y("standard", undefined, errors?.standard)}
            name="standard"
            defaultValue={defaults.standard}
          >
            <option value="">{copy.standardNone}</option>
            {Object.entries(projectsCopy.standards).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField
          id="startDate"
          label={copy.startDate}
          error={errors?.startDate}
        >
          <Input
            {...fieldA11y("startDate", undefined, errors?.startDate)}
            name="startDate"
            type="date"
            defaultValue={defaults.startDate}
            className="max-w-56"
          />
        </FormField>

        {showStatus ? (
          <FormField id="status" label={copy.status} error={errors?.status}>
            <NativeSelect
              {...fieldA11y("status", undefined, errors?.status)}
              name="status"
              defaultValue={defaults.status}
            >
              {Object.entries(projectsCopy.statuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        ) : null}

        <FormField id="address" label={copy.address} error={errors?.address}>
          <Input
            {...fieldA11y("address", undefined, errors?.address)}
            name="address"
            defaultValue={defaults.address}
            autoComplete="street-address"
            maxLength={200}
          />
        </FormField>
      </fieldset>

      {state.status === "error" && state.message ? (
        <FormMessage>{state.message}</FormMessage>
      ) : null}
      {state.status === "success" && state.message ? (
        <FormMessage tone="success">{state.message}</FormMessage>
      ) : null}

      {disabled ? null : (
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="h-13 w-full rounded-xl text-base sm:w-auto sm:px-10"
        >
          {pending ? submittingLabel : submitLabel}
        </Button>
      )}
    </form>
  );
}
