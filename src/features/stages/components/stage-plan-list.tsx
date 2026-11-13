import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import type { BudgetLevel } from "../budget";
import { stagesCopy } from "../copy";
import type { StagePlanRow } from "../queries";

const { status: statusCopy, plan: planCopy } = stagesCopy;

const LEVEL_STYLES: Record<BudgetLevel, string> = {
  none: "bg-muted text-muted-foreground",
  ok: "bg-status-ok-soft text-status-ok",
  warn: "bg-status-warn-soft text-status-warn",
  over: "bg-status-danger-soft text-status-danger",
};

/** Etiqueta do alerta (cores próprias, separadas do dourado da marca). */
export function BudgetBadge({ level }: { level: BudgetLevel }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold dark:bg-transparent dark:ring-1 dark:ring-current",
        LEVEL_STYLES[level],
      )}
    >
      {statusCopy[level]}
    </span>
  );
}

/**
 * Previsto x realizado por etapa: barra dourada = gasto; mais clara = a pagar;
 * o traço marca o previsto. Etapas sem previsto mostram só o gasto.
 */
export function StagePlanList({
  plans,
  hrefFor,
}: {
  plans: StagePlanRow[];
  hrefFor?: (stageId: string) => string;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {plans.map((plan) => {
        const used = plan.spentCents + plan.committedCents;
        const scale = Math.max(1, plan.budgetCents ?? 0, used);
        const pct = (cents: number) => `${(cents / scale) * 100}%`;
        const content = (
          <>
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0 font-medium">{plan.name}</span>
              {plan.budgetCents !== null ? (
                <BudgetBadge level={plan.status.level} />
              ) : null}
            </span>
            <span
              aria-hidden
              className="relative mt-2 block h-3 overflow-hidden rounded-full bg-muted"
            >
              <span
                className="absolute inset-y-0 left-0 bg-brand-gold"
                style={{ width: pct(plan.spentCents) }}
              />
              <span
                className="absolute inset-y-0 bg-brand-gold/40"
                style={{
                  left: pct(plan.spentCents),
                  width: pct(plan.committedCents),
                }}
              />
              {plan.budgetCents ? (
                <span
                  className="absolute inset-y-0 w-0.5 bg-foreground"
                  style={{ left: `calc(${pct(plan.budgetCents)} - 2px)` }}
                />
              ) : null}
            </span>
            <span className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
              {/* `money` em cada valor, não na linha toda: com conta a pagar
                  a linha passa da largura do celular e precisa quebrar. */}
              <span className="min-w-0 tabular-nums">
                {plan.budgetCents !== null ? (
                  <>
                    <span className="font-bold money">
                      {planCopy.spentOf(
                        formatCents(plan.spentCents),
                        formatCents(plan.budgetCents),
                      )}
                    </span>
                    {plan.status.usedPercent !== null ? (
                      <span className="text-muted-foreground">
                        {" · "}
                        {planCopy.usedPercent(plan.status.usedPercent)}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="font-bold money">
                    {formatCents(plan.spentCents)}
                  </span>
                )}
                {plan.committedCents > 0 ? (
                  <>
                    {/* O espaço fica fora do `money`: é onde a linha quebra. */}{" "}
                    <span className="money text-muted-foreground">
                      {planCopy.committed(formatCents(plan.committedCents))}
                    </span>
                  </>
                ) : null}
              </span>
              <span className="text-muted-foreground">
                {planCopy.progress(plan.progressPercent)}
              </span>
            </span>
            {plan.status.aheadOfProgress ? (
              <span className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-status-warn">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {statusCopy.aheadDetail(
                  plan.status.spentPercent ?? 0,
                  plan.progressPercent,
                )}
              </span>
            ) : null}
          </>
        );
        return (
          <li key={plan.id}>
            {hrefFor ? (
              <Link
                href={hrefFor(plan.id)}
                className="-mx-2 block rounded-lg px-2 py-1 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                {content}
              </Link>
            ) : (
              <div className="py-1">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
