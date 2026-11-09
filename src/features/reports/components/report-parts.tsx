import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Peças do relatório: seção com título e tabela simples. Pensadas para papel
 * (fundo branco, bordas finas, linhas que não quebram entre páginas) e para
 * a tela do celular (a tabela rola de lado dentro da seção).
 */
export function ReportSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="mt-8 print:mt-6">
      <h2 className="mb-3 border-b-2 border-foreground pb-1 text-lg heading print:break-after-avoid">
        {title}
      </h2>
      {children}
    </section>
  );
}

export type Column = {
  label: string;
  /** Coluna de valor: alinhada à direita, com números tabulares. */
  numeric?: boolean;
};

export function ReportTable({
  columns,
  rows,
  footer,
}: {
  columns: Column[];
  rows: { key: string; cells: ReactNode[]; className?: string }[];
  footer?: ReactNode[];
}) {
  const align = (column: Column) =>
    column.numeric ? "text-right money" : "text-left";
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0 print:mx-0 print:overflow-visible print:px-0">
      <table className="w-full min-w-max border-collapse text-sm print:min-w-0 print:text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            {columns.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={cn(
                  "px-2 py-1.5 font-semibold first:pl-0 last:pr-0",
                  align(column),
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={cn("break-inside-avoid border-b", row.className)}
            >
              {row.cells.map((cell, index) => (
                <td
                  key={columns[index]?.label ?? index}
                  className={cn(
                    "px-2 py-1.5 align-top first:pl-0 last:pr-0",
                    align(columns[index] ?? { label: "" }),
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer ? (
          <tfoot>
            <tr className="break-inside-avoid border-t-2 border-foreground font-bold">
              {footer.map((cell, index) => (
                <td
                  key={columns[index]?.label ?? index}
                  className={cn(
                    "px-2 py-1.5 first:pl-0 last:pr-0",
                    align(columns[index] ?? { label: "" }),
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

/** Par rótulo/valor do resumo. */
export function ReportFigure({
  label,
  value,
  detail,
  strong,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="break-inside-avoid">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-bold money",
          strong ? "text-2xl print:text-xl" : "text-lg print:text-base",
        )}
      >
        {value}
      </dd>
      {detail ? (
        <dd className="text-sm text-muted-foreground">{detail}</dd>
      ) : null}
    </div>
  );
}
