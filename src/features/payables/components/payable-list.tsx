import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { daysBetween, formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import { payablesCopy } from "../copy";
import { dueState } from "../installments";

const { list: listCopy, due: dueCopy } = payablesCopy;

export type PayableRow = {
  id: string;
  project_id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: "open" | "paid" | "cancelled";
  installment_number: number | null;
  installment_total: number | null;
  stage: { name: string } | null;
  supplier: { name: string } | null;
  paid_expense: { amount_cents: number; spent_on: string } | null;
  project?: { name: string } | null;
};

/** "vence hoje", "venceu há 3 dias", "vence em 12/12/2026"... */
export function dueLabel(dueDate: string, today: string): string {
  const days = daysBetween(today, dueDate);
  if (days < 0) return dueCopy.overdue(-days);
  if (days === 0) return dueCopy.today;
  if (days === 1) return dueCopy.tomorrow;
  if (days <= 7) return dueCopy.inDays(days);
  return dueCopy.on(formatDate(dueDate));
}

const DUE_STYLES = {
  overdue: "font-semibold text-status-danger",
  today: "font-semibold text-status-warn",
  soon: "font-medium text-status-warn",
  later: "text-muted-foreground",
} as const;

/** Lista de contas. Cada linha abre a conta para pagar, editar ou ver. */
export function PayableList({
  payables,
  hrefFor,
  today,
  showProject = false,
}: {
  payables: PayableRow[];
  hrefFor: (payable: PayableRow) => string;
  today: string;
  showProject?: boolean;
}) {
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
      {payables.map((payable) => {
        const details = [
          showProject ? payable.project?.name : null,
          payable.installment_total
            ? listCopy.installment(
                payable.installment_number ?? 0,
                payable.installment_total,
              )
            : null,
          payable.stage?.name ?? listCopy.noStage,
          payable.supplier?.name,
        ].filter(Boolean);

        const open = payable.status === "open";
        const amount =
          payable.status === "paid" && payable.paid_expense
            ? payable.paid_expense.amount_cents
            : payable.amount_cents;
        const when = open
          ? dueLabel(payable.due_date, today)
          : payable.status === "paid" && payable.paid_expense
            ? listCopy.paidOn(formatDate(payable.paid_expense.spent_on))
            : formatDate(payable.due_date);

        return (
          <li key={payable.id}>
            <Link
              href={hrefFor(payable)}
              className="flex items-center gap-3 px-4 py-3.5 outline-none hover:bg-muted/50 focus-visible:bg-muted/60"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "truncate font-semibold",
                    payable.status === "cancelled" &&
                      "text-muted-foreground line-through",
                  )}
                >
                  {payable.description}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {details.join(" · ")}
                </span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span
                  className={cn(
                    "font-bold money",
                    !open && "text-muted-foreground",
                  )}
                >
                  {formatCents(amount)}
                </span>
                <span
                  className={cn(
                    "text-sm whitespace-nowrap",
                    open
                      ? DUE_STYLES[dueState(payable.due_date, today)]
                      : "text-muted-foreground",
                  )}
                >
                  {when}
                </span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
