import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { DEFAULT_TIMEZONE } from "@/config/app";
import { accessLabel } from "@/features/admin/access";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { adminCopy as copy } from "@/features/admin/copy";
import { type AdminOrg, listAdminOrgs } from "@/features/admin/queries";
import { estimateAiCostUsd } from "@/lib/billing/costs";
import { addMonths, formatDate, todayIn } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: copy.title,
  robots: { index: false, follow: false },
};

const number = new Intl.NumberFormat("pt-BR");
const usd = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const monthLabel = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-11" da URL vira "2026-11-01"; sem ou inválido, o mês atual. */
function parseMonth(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return `${value}-01`;
  return `${todayIn(DEFAULT_TIMEZONE).slice(0, 7)}-01`;
}

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <AdminShell>
      <h1 className="text-2xl heading md:text-4xl">{copy.title}</h1>
      <p className="mt-2 text-muted-foreground">{copy.description}</p>
      <Suspense fallback={<div className="mt-8 h-96" />}>
        <AdminContent searchParams={searchParams} />
      </Suspense>
    </AdminShell>
  );
}

async function AdminContent({
  searchParams,
}: {
  searchParams: PageProps<"/admin">["searchParams"];
}) {
  const params = await searchParams;
  // O mês atual depende da hora do pedido: nada aqui é pré-renderizado.
  await connection();
  const month = parseMonth(params.mes);
  const orgs = await listAdminOrgs(month);
  if (!orgs) notFound();

  const sum = (pick: (org: AdminOrg) => number) =>
    orgs.reduce((total, org) => total + pick(org), 0);
  const totalCost = sum((org) => estimateAiCostUsd(org));
  const totals = [
    [copy.totals.accounts, number.format(orgs.length)],
    [
      copy.totals.trialing,
      number.format(orgs.filter((o) => o.status === "trialing").length),
    ],
    [
      copy.totals.active,
      number.format(orgs.filter((o) => o.status === "active").length),
    ],
    [copy.totals.expenses, number.format(sum((o) => Number(o.expenses_month)))],
    [copy.totals.whatsapp, number.format(sum((o) => o.whatsapp_entries))],
    [copy.totals.aiCalls, number.format(sum((o) => o.ai_calls))],
    [copy.totals.aiCost, usd.format(totalCost)],
    [copy.totals.templates, number.format(sum((o) => o.template_messages))],
  ];
  const nav = (offset: number) =>
    `/admin?mes=${addMonths(month, offset).slice(0, 7)}`;

  return (
    <>
      <nav className="mt-6 flex items-center gap-2">
        <Link
          href={nav(-1)}
          aria-label={copy.previous}
          className="inline-flex size-11 items-center justify-center rounded-lg border hover:bg-muted"
        >
          <ChevronLeft aria-hidden />
        </Link>
        <span className="min-w-40 text-center text-lg font-semibold first-letter:uppercase">
          {monthLabel.format(new Date(`${month}T00:00:00Z`))}
        </span>
        <Link
          href={nav(1)}
          aria-label={copy.next}
          className="inline-flex size-11 items-center justify-center rounded-lg border hover:bg-muted"
        >
          <ChevronRight aria-hidden />
        </Link>
      </nav>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {totals.map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-bold money">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">{copy.costNote}</p>

      {orgs.length === 0 ? (
        <p className="mt-8 text-muted-foreground">{copy.empty}</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[68rem] text-left text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {[
                  copy.table.account,
                  copy.table.owner,
                  copy.table.plan,
                  copy.table.status,
                  copy.table.projects,
                  copy.table.members,
                  copy.table.expenses,
                  copy.table.whatsapp,
                  copy.table.aiCalls,
                  copy.table.aiCost,
                  copy.table.access,
                  copy.table.createdAt,
                ].map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-3 py-2 font-semibold"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {orgs.map((org) => (
                <tr key={org.org_id}>
                  <td className="px-3 py-2 font-medium">{org.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {org.owner_email ?? "—"}
                  </td>
                  <td className="px-3 py-2">{org.plan_name ?? "—"}</td>
                  <td
                    className={cn(
                      "px-3 py-2",
                      (org.status === "past_due" ||
                        org.status === "cancelled") &&
                        "text-status-danger",
                    )}
                  >
                    {org.status
                      ? copy.statuses[org.status]
                      : copy.noSubscription}
                    {org.status === "trialing" && org.trial_ends_at
                      ? ` · ${formatDate(org.trial_ends_at.slice(0, 10))}`
                      : null}
                  </td>
                  <td className="px-3 py-2 money">
                    {number.format(Number(org.projects))}
                  </td>
                  <td className="px-3 py-2 money">
                    {number.format(Number(org.members))}
                  </td>
                  <td className="px-3 py-2 money">
                    {number.format(Number(org.expenses_month))}
                  </td>
                  <td className="px-3 py-2 money">
                    {number.format(org.whatsapp_entries)}
                  </td>
                  <td className="px-3 py-2 money">
                    {number.format(org.ai_calls)}
                  </td>
                  <td className="px-3 py-2 money">
                    {usd.format(estimateAiCostUsd(org))}
                  </td>
                  <td className="px-3 py-2">
                    <AccessCell org={org} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDate(org.created_at.slice(0, 10))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Etiqueta do acesso decidido pela equipe e o atalho para mudar. */
function AccessCell({ org }: { org: AdminOrg }) {
  const label = accessLabel(org.access_override, org.access_override_at);
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span
        className={cn(
          label.tone === "blocked" && "font-semibold text-status-danger",
          label.tone === "scheduled" && "text-status-warn",
          label.tone === "free" && "font-semibold text-status-ok",
          label.tone === "normal" && "text-muted-foreground",
        )}
        title={org.access_note ?? undefined}
      >
        {label.text}
      </span>
      <Link
        href={`/admin/contas/${org.org_id}`}
        className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
      >
        {copy.access.change}
        <span className="sr-only"> · {org.name}</span>
      </Link>
    </span>
  );
}
