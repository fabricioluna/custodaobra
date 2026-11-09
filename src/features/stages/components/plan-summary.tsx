import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import { worstLevel } from "../budget";
import { stagesCopy } from "../copy";
import type { summarizePlans } from "../queries";

import { BudgetBadge } from "./stage-plan-list";

const copy = stagesCopy.overview;

/** Previsto, gasto, a pagar e sobra das etapas com previsto. */
export function PlanSummary({
  summary,
  className,
}: {
  summary: ReturnType<typeof summarizePlans>;
  className?: string;
}) {
  const used = summary.spentCents + summary.committedCents;
  const remaining = summary.budgetCents - used;
  const level = worstLevel(summary.alerts.map((plan) => plan.status.level));

  const rows: [string, number, string?][] = [
    [copy.planned, summary.budgetCents],
    [copy.spent, summary.spentCents],
  ];
  if (summary.committedCents > 0) {
    rows.push([copy.committed, summary.committedCents]);
  }
  rows.push(
    remaining >= 0
      ? [copy.remaining, remaining]
      : [copy.overBy, -remaining, "text-status-danger"],
  );

  return (
    <section
      aria-label={copy.planned}
      className={cn(
        "max-w-2xl rounded-2xl border bg-card p-4 md:p-5",
        className,
      )}
    >
      {level === "warn" || level === "over" ? (
        <div className="mb-3">
          <BudgetBadge level={level} />
        </div>
      ) : null}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {rows.map(([label, cents, tone]) => (
          <div key={label}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className={cn("text-lg font-bold money", tone)}>
              {formatCents(cents)}
            </dd>
          </div>
        ))}
      </dl>
      {summary.unbudgetedSpentCents > 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {copy.unbudgetedNote(formatCents(summary.unbudgetedSpentCents))}
        </p>
      ) : null}
    </section>
  );
}
