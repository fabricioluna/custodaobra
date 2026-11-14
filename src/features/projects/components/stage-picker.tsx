"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";

import { projectsCopy } from "../copy";

const copy = projectsCopy.stagePicker;

/**
 * Etapas da obra nova: as sugeridas vêm marcadas, a pessoa desmarca as que
 * não servem (ou começa sem nenhuma). Vai no formulário como "stage" (uma por
 * etapa marcada) e "stagesChosen" (para a ação saber que a escolha veio).
 */
export function StagePicker({ templates }: { templates: string[] }) {
  const uid = useId();
  const [checked, setChecked] = useState<Set<string>>(() => new Set(templates));
  const toggle = (name: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const all = checked.size === templates.length;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-lg heading">{copy.legend}</legend>
      <p className="text-muted-foreground">{copy.description}</p>
      <input type="hidden" name="stagesChosen" value="1" />
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {templates.map((name, index) => {
          const id = `${uid}-stage-${index}`;
          return (
            <li key={name}>
              <label
                htmlFor={id}
                className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2"
              >
                <input
                  id={id}
                  type="checkbox"
                  name="stage"
                  value={name}
                  checked={checked.has(name)}
                  onChange={() => toggle(name)}
                  className="size-5 shrink-0 accent-brand-navy"
                />
                <span>{name}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {copy.count(checked.size, templates.length)}
        </p>
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-2"
          onClick={() => setChecked(all ? new Set() : new Set(templates))}
        >
          {all ? copy.selectNone : copy.selectAll}
        </Button>
      </div>
    </fieldset>
  );
}
