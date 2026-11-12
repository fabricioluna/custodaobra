import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { orgPath } from "@/components/layout/nav";
import { PageHeader } from "@/components/layout/page-header";
import { SubscriptionSection } from "@/features/billing/components/subscription-section";
import { UsageMeter } from "@/features/billing/components/usage-meter";
import { billingCopy as copy } from "@/features/billing/copy";
import { requireOrg } from "@/features/organizations/queries";
import { canManageOrg } from "@/features/projects/queries";
import { settingsCopy } from "@/features/settings/copy";
import { getPlanOverview, type SubscriptionState } from "@/lib/billing/limits";
import { BILLING_LIVE } from "@/lib/billing/plans";
import { formatDate, todayIn } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: copy.page.title };

function phaseLabel(state: SubscriptionState): string {
  switch (state.phase) {
    case "trial":
      return copy.phases.trial(state.daysLeft);
    case "trial_over":
      return copy.phases.trialOver;
    case "active":
      return copy.phases.active;
    case "past_due":
      return copy.phases.pastDue;
    case "past_due_over":
      return copy.phases.pastDueOver;
    case "cancelled":
      return copy.phases.cancelled;
  }
}

/** Plano, situação e uso do mês. Só dono e admin. */
export default async function PlanPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/configuracoes/plano">) {
  const [{ orgSlug }, { assinatura }] = await Promise.all([
    params,
    searchParams,
  ]);
  const org = await requireOrg(orgSlug);
  if (!(await canManageOrg(org.id))) notFound();

  const supabase = await createClient();
  const overview = await getPlanOverview(
    supabase,
    org.id,
    todayIn(org.timezone),
  );
  if (!overview) notFound();
  const { plan, state, usage } = overview;
  // Sem cobrança no ar, prazo de teste não vale nada: não mostra.
  const showPhase = BILLING_LIVE || state.phase === "cancelled";

  return (
    <>
      <BackLink
        href={orgPath(org.slug, "configuracoes")}
        label={settingsCopy.title}
      />
      <PageHeader title={copy.page.title} description={copy.page.description} />

      <div className="flex max-w-xl flex-col gap-10">
        <section className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">{copy.page.plan}</p>
          <h2 className="mt-1 text-2xl heading">{plan.name}</h2>
          <p className="mt-2">
            {plan.price_cents_month > 0 ? (
              <>
                <span className="text-xl font-bold money">
                  {formatCents(plan.price_cents_month)}
                </span>
                <span className="text-muted-foreground">
                  {copy.page.perMonth}
                </span>
              </>
            ) : (
              <span className="font-semibold">{copy.page.free}</span>
            )}
          </p>
          {showPhase ? (
            <p
              className={cn(
                "mt-3 font-medium",
                state.usable ? "text-muted-foreground" : "text-status-danger",
              )}
            >
              {phaseLabel(state)}
              {state.phase === "trial" && overview.trialEndsAt
                ? ` (${formatDate(todayIn(org.timezone, new Date(overview.trialEndsAt)))})`
                : null}
            </p>
          ) : null}
          <div className="mt-4 flex flex-col">
            <SubscriptionSection
              orgId={org.id}
              orgSlug={org.slug}
              justCreated={assinatura === "criada"}
            />
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-lg heading">{copy.page.usage}</h2>
          <UsageMeter label={copy.meters.projects} {...usage.projects} />
          <UsageMeter label={copy.meters.members} {...usage.members} />
          {plan.whatsapp_enabled ? (
            <>
              <UsageMeter
                label={copy.meters.whatsappEntries}
                {...usage.whatsappEntries}
              />
              <UsageMeter
                label={copy.meters.aiCalls}
                hint={copy.meters.aiCallsHint}
                {...usage.aiCalls}
              />
              <UsageMeter
                label={copy.meters.templateMessages}
                hint={copy.meters.templateMessagesHint}
                {...usage.templateMessages}
              />
              <p className="text-sm text-muted-foreground">
                {copy.page.monthNote}
              </p>
            </>
          ) : null}
        </section>
      </div>
    </>
  );
}
