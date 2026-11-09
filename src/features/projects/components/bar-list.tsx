import Link from "next/link";

import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export type BarItem = {
  key: string;
  label: string;
  cents: number;
  href?: string;
  muted?: boolean;
};

/**
 * Barras horizontais com rótulo e valor: legível no celular, sem biblioteca
 * de gráfico. O dourado é o "realizado" (dinheiro gasto).
 */
export function BarList({
  items,
  emptyLabel = "—",
}: {
  items: BarItem[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.cents));
  return (
    <ul className="flex flex-col gap-3.5">
      {items.map((item) => {
        const width =
          item.cents > 0 ? Math.max(2, (item.cents / max) * 100) : 0;
        const content = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "truncate",
                  item.muted ? "text-muted-foreground" : "font-medium",
                )}
              >
                {item.label}
              </span>
              <span
                className={cn(
                  "shrink-0 money",
                  item.cents > 0 ? "font-bold" : "text-muted-foreground",
                )}
              >
                {item.cents > 0 ? formatCents(item.cents) : emptyLabel}
              </span>
            </span>
            <span
              aria-hidden
              className="mt-1.5 block h-2.5 overflow-hidden rounded-full bg-muted"
            >
              <span
                className="block h-full rounded-full bg-brand-gold"
                style={{ width: `${width}%` }}
              />
            </span>
          </>
        );
        return (
          <li key={item.key}>
            {item.href ? (
              <Link
                href={item.href}
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
