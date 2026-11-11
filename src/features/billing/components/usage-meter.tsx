import { cn } from "@/lib/utils";

import { billingCopy } from "../copy";

const copy = billingCopy.meters;
const number = new Intl.NumberFormat("pt-BR");

/** Barra de uso: neutra, amarela a partir de 80% e vermelha no limite. */
export function UsageMeter({
  label,
  hint,
  used,
  limit,
}: {
  label: string;
  hint?: string;
  used: number;
  limit: number;
}) {
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 1;
  const full = used >= limit;
  const tone = full
    ? "bg-status-danger"
    : ratio >= 0.8
      ? "bg-status-warn"
      : "bg-primary";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="font-semibold">{label}</span>
        <span className="money text-muted-foreground">
          {copy.of(number.format(used), number.format(limit))}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        className="h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {full ? (
        <span className="text-sm font-medium text-status-danger">
          {copy.full}
        </span>
      ) : hint ? (
        <span className="text-sm text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}
