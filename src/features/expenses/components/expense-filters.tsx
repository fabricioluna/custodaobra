import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

import { expensesCopy } from "../copy";
import { type ExpenseFilters as Filters, hasActiveFilters } from "../schemas";
import type { ExpenseFormOptions } from "./expense-form";

const copy = expensesCopy.filters;

/**
 * Rótulos por aria-label, sem id: o Next.js guarda páginas visitadas escondidas
 * no DOM, e ids repetidos ligariam o rótulo ao campo errado.
 *
 * Filtros da lista como formulário GET: tudo vai para a URL, a página lê no
 * servidor e o resultado já vem no HTML. Funciona até sem JavaScript.
 */
export function ExpenseFilters({
  action,
  filters,
  options,
}: {
  action: string;
  filters: Filters;
  options: ExpenseFormOptions;
}) {
  const advancedActive = Boolean(
    filters.de ||
    filters.ate ||
    filters.etapa ||
    filters.categoria ||
    filters.fornecedor ||
    filters.nota,
  );

  return (
    <form action={action} method="get" className="mb-5 flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            name="q"
            aria-label={copy.search}
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder={copy.searchPlaceholder}
            className="pl-11"
            enterKeyHint="search"
          />
        </div>
        <Button type="submit" size="lg" className="rounded-xl">
          {copy.apply}
        </Button>
      </div>

      <details open={advancedActive || undefined} className="group">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="size-5" aria-hidden />
          {copy.title}
        </summary>
        <div className="mt-3 grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span aria-hidden className="text-base font-semibold">
              {copy.from}
            </span>
            <Input
              name="de"
              aria-label={copy.from}
              type="date"
              defaultValue={filters.de ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span aria-hidden className="text-base font-semibold">
              {copy.to}
            </span>
            <Input
              name="ate"
              aria-label={copy.to}
              type="date"
              defaultValue={filters.ate ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span aria-hidden className="text-base font-semibold">
              {copy.stage}
            </span>
            <NativeSelect
              name="etapa"
              aria-label={copy.stage}
              defaultValue={filters.etapa ?? ""}
            >
              <option value="">{copy.any}</option>
              <option value="sem">{copy.noStage}</option>
              {options.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <span aria-hidden className="text-base font-semibold">
              {copy.category}
            </span>
            <NativeSelect
              name="categoria"
              aria-label={copy.category}
              defaultValue={filters.categoria ?? ""}
            >
              <option value="">{copy.any}</option>
              {options.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <span aria-hidden className="text-base font-semibold">
              {copy.supplier}
            </span>
            <NativeSelect
              name="fornecedor"
              aria-label={copy.supplier}
              defaultValue={filters.fornecedor ?? ""}
            >
              <option value="">{copy.anySupplier}</option>
              {[...options.suppliers]
                .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                .map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <span aria-hidden className="text-base font-semibold">
              {copy.invoice}
            </span>
            <NativeSelect
              name="nota"
              aria-label={copy.invoice}
              defaultValue={filters.nota ?? ""}
            >
              <option value="">{copy.any}</option>
              <option value="com">{copy.withInvoice}</option>
              <option value="sem">{copy.withoutInvoice}</option>
            </NativeSelect>
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" size="lg" className="rounded-xl">
              {copy.apply}
            </Button>
            {hasActiveFilters(filters) ? (
              <Link
                href={action}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "rounded-xl",
                )}
              >
                {copy.clear}
              </Link>
            ) : null}
          </div>
        </div>
      </details>
    </form>
  );
}
