import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { BackLink } from "@/components/layout/back-link";
import { DEFAULT_TIMEZONE } from "@/config/app";
import { accessFormDefaults, accessLabel } from "@/features/admin/access";
import { AccessForm } from "@/features/admin/components/access-form";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { adminCopy } from "@/features/admin/copy";
import { getAdminOrg, listActivePlans } from "@/features/admin/queries";
import { formatDate, todayIn } from "@/lib/dates";
import { isUuid } from "@/lib/forms";

const copy = adminCopy.access;

export const metadata: Metadata = {
  title: copy.title,
  robots: { index: false, follow: false },
};

/** Liberar ou bloquear uma conta. Só a equipe do app. */
export default function AdminAccessPage({
  params,
}: PageProps<"/admin/contas/[orgId]">) {
  return (
    <AdminShell>
      <BackLink href="/admin" label={copy.back} />
      <h1 className="text-2xl heading md:text-4xl">{copy.title}</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">{copy.description}</p>
      <Suspense fallback={<div className="mt-8 h-96" />}>
        <AccessContent params={params} />
      </Suspense>
    </AdminShell>
  );
}

async function AccessContent({
  params,
}: {
  params: PageProps<"/admin/contas/[orgId]">["params"];
}) {
  const { orgId } = await params;
  if (!isUuid(orgId)) notFound();
  await connection();
  const month = `${todayIn(DEFAULT_TIMEZONE).slice(0, 7)}-01`;
  const [org, plans] = await Promise.all([
    getAdminOrg(orgId, month),
    listActivePlans(),
  ]);
  if (!org) notFound();

  const { mode, date } = accessFormDefaults(
    org.access_override,
    org.access_override_at,
  );
  const details = [
    [copy.owner, org.owner_email ?? "—"],
    [copy.plan, org.plan_name ?? "—"],
    [
      copy.status,
      org.status
        ? `${adminCopy.statuses[org.status]}${
            org.status === "trialing" && org.trial_ends_at
              ? ` · ${formatDate(todayIn(DEFAULT_TIMEZONE, new Date(org.trial_ends_at)))}`
              : ""
          }`
        : adminCopy.noSubscription,
    ],
    [copy.now, accessLabel(org.access_override, org.access_override_at).text],
  ];

  return (
    <div className="mt-8 flex max-w-xl flex-col gap-8">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-xl heading">{org.name}</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {details.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <AccessForm
        orgId={org.org_id}
        mode={mode}
        date={date}
        note={org.access_note ?? ""}
        planName={org.plan_name ?? "—"}
        plans={plans}
      />
    </div>
  );
}
