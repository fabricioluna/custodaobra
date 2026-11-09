import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Opção grande de rádio (área de toque de sobra para o canteiro), com título e
 * uma linha de explicação.
 */
export function Choice({
  name,
  value,
  checked,
  defaultChecked,
  onChange,
  title,
  hint,
  icon,
}: {
  name: string;
  value: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (value: string) => void;
  title: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border bg-card px-4 py-3 transition-colors",
        "has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/40",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange ? () => onChange(value) : undefined}
        className="mt-1 size-5 shrink-0 accent-primary outline-none"
      />
      {icon}
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{title}</span>
        {hint ? (
          <span className="text-sm text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}
