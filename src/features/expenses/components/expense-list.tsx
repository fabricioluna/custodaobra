import { ChevronRight, Paperclip } from "lucide-react";
import Link from "next/link";

import { formatRelativeDate } from "@/lib/dates";
import { formatCents, formatQuantity } from "@/lib/money";

import { expensesCopy } from "../copy";
import type { ExpenseListItem } from "../queries";

/** Lista de lançamentos. Cada linha abre o gasto para ver ou editar. */
export function ExpenseList({
  expenses,
  hrefFor,
  today,
}: {
  expenses: ExpenseListItem[];
  hrefFor: (expenseId: string) => string;
  today: string;
}) {
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
      {expenses.map((expense) => {
        const details = [
          expense.category?.name,
          expense.stage?.name ?? expensesCopy.list.noStage,
          expense.supplier?.name,
        ].filter(Boolean);
        const quantity =
          expense.quantity !== null
            ? `${formatQuantity(expense.quantity)}${expense.unit ? ` ${expense.unit}` : ""}`
            : null;
        return (
          <li key={expense.id}>
            <Link
              href={hrefFor(expense.id)}
              className="flex items-center gap-3 px-4 py-3.5 outline-none hover:bg-muted/50 focus-visible:bg-muted/60"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold">
                  {expense.description}
                  {quantity ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {quantity}
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {details.join(" · ")}
                </span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className="font-bold money">
                  {formatCents(expense.amount_cents)}
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  {expense.attachments.length > 0 ? (
                    <Paperclip
                      className="size-3.5"
                      aria-label={expensesCopy.list.withReceipt}
                    />
                  ) : null}
                  {formatRelativeDate(expense.spent_on, today)}
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
