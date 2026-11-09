"use client";

import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import {
  startTransition,
  useActionState,
  useId,
  useState,
  useTransition,
} from "react";

import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { StageFormState } from "../actions";
import { stagesCopy as copy } from "../copy";

export type EditableStage = { id: string; name: string; expenseCount: number };

type Actions = {
  rename: (
    stageId: string,
    prev: StageFormState,
    formData: FormData,
  ) => Promise<StageFormState>;
  move: (stageId: string, direction: "up" | "down") => Promise<StageFormState>;
  remove: (stageId: string) => Promise<StageFormState>;
  add: (prev: StageFormState, formData: FormData) => Promise<StageFormState>;
};

/** Lista editável de etapas: renomear, subir, descer, remover e adicionar. */
export function StageEditor({
  stages,
  actions,
}: {
  stages: EditableStage[];
  actions: Actions;
}) {
  const [pending, startMove] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(task: () => Promise<StageFormState>) {
    setError(null);
    startMove(async () => {
      const result = await task();
      if (result.status === "error") setError(result.message ?? null);
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {error ? <FormMessage>{error}</FormMessage> : null}
      <ol className="flex flex-col gap-2" aria-busy={pending}>
        {stages.map((stage, index) => (
          <StageRow
            key={stage.id}
            stage={stage}
            position={index + 1}
            isFirst={index === 0}
            isLast={index === stages.length - 1}
            disabled={pending}
            rename={actions.rename.bind(null, stage.id)}
            onMove={(direction) => run(() => actions.move(stage.id, direction))}
            onRemove={() => {
              if (
                window.confirm(
                  copy.confirmRemove(stage.name, stage.expenseCount),
                )
              ) {
                run(() => actions.remove(stage.id));
              }
            }}
          />
        ))}
      </ol>
      <AddStageForm action={actions.add} />
    </div>
  );
}

function StageRow({
  stage,
  position,
  isFirst,
  isLast,
  disabled,
  rename,
  onMove,
  onRemove,
}: {
  stage: EditableStage;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  rename: (prev: StageFormState, formData: FormData) => Promise<StageFormState>;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
}) {
  const [state, formAction, saving] = useActionState(rename, {
    status: "idle",
  });
  const [name, setName] = useState(stage.name);
  const changed = name.trim() !== stage.name;
  const inputId = `stage-${stage.id}`;
  const fieldError = state.status === "error" ? state.fieldErrors?.name : null;

  return (
    <li className="rounded-2xl border bg-card p-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="flex items-center gap-2"
      >
        <span
          aria-hidden
          className="w-6 shrink-0 text-center text-sm font-bold text-muted-foreground"
        >
          {position}
        </span>
        <Label htmlFor={inputId} className="sr-only">
          {copy.nameLabel(position)}
        </Label>
        <Input
          id={inputId}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          aria-invalid={fieldError ? true : undefined}
          className="h-11 flex-1"
        />
        {changed ? (
          <Button
            type="submit"
            size="icon"
            disabled={saving}
            aria-label={copy.save}
            title={copy.save}
          >
            <Check aria-hidden />
          </Button>
        ) : null}
      </form>
      <div className="mt-2 flex items-center gap-1 pl-8">
        <span className="flex-1 text-sm text-muted-foreground">
          {copy.expenses(stage.expenseCount)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || isFirst}
          onClick={() => onMove("up")}
          aria-label={copy.moveUp(stage.name)}
          title={copy.moveUp(stage.name)}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || isLast}
          onClick={() => onMove("down")}
          aria-label={copy.moveDown(stage.name)}
          title={copy.moveDown(stage.name)}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={onRemove}
          aria-label={copy.remove(stage.name)}
          title={copy.remove(stage.name)}
          className="text-status-danger"
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      {fieldError || (state.status === "error" && state.message) ? (
        <p className="mt-2 pl-8 text-sm text-status-danger">
          {fieldError ?? (state.status === "error" ? state.message : null)}
        </p>
      ) : null}
    </li>
  );
}

function AddStageForm({
  action,
}: {
  action: (prev: StageFormState, formData: FormData) => Promise<StageFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const [name, setName] = useState("");
  const fieldError = state.status === "error" ? state.fieldErrors?.name : null;
  const inputId = useId();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          await formAction(formData);
        });
        setName("");
      }}
      className="flex flex-col gap-2.5"
    >
      <Label htmlFor={inputId}>{copy.addLabel}</Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={copy.addPlaceholder}
          maxLength={80}
          aria-invalid={fieldError ? true : undefined}
          className="flex-1"
        />
        <Button
          type="submit"
          size="lg"
          disabled={pending || !name.trim()}
          className="rounded-xl"
        >
          <Plus aria-hidden />
          {copy.add}
        </Button>
      </div>
      {fieldError ? (
        <p className="text-sm text-status-danger">{fieldError}</p>
      ) : null}
    </form>
  );
}
