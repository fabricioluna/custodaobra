import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { orgPath } from "@/components/layout/nav";
import { PageHeader } from "@/components/layout/page-header";
import { CheckoutForm } from "@/features/billing/components/checkout-form";
import { billingCopy as copy } from "@/features/billing/copy";
import {
  getBillingSubscription,
  getPaidPlans,
} from "@/features/billing/queries";
import { requireOrg } from "@/features/organizations/queries";
import { canManageOrg } from "@/features/projects/queries";
import { isAsaasConfigured } from "@/lib/billing/asaas";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: copy.subscribe.title };

/** Escolher o plano (e, na primeira vez, os dados da cobrança). */
export default async function SubscribePage({
  params,
}: PageProps<"/o/[orgSlug]/configuracoes/plano/assinar">) {
  const { orgSlug } = await params;
  const org = await requireOrg(orgSlug);
  if (!isAsaasConfigured() || !(await canManageOrg(org.id))) notFound();

  const supabase = await createClient();
  const [plans, subscription, claims] = await Promise.all([
    getPaidPlans(),
    getBillingSubscription(org.id),
    supabase.auth.getClaims(),
  ]);
  if (!subscription) notFound();
  const email = claims.data?.claims?.email;
  const changing = Boolean(subscription.provider_subscription_id);

  return (
    <>
      <BackLink
        href={orgPath(org.slug, "configuracoes", "plano")}
        label={copy.page.title}
      />
      <PageHeader
        title={changing ? copy.subscribe.change : copy.subscribe.title}
        description={copy.subscribe.description}
      />
      <div className="flex max-w-xl flex-col gap-6">
        {plans.length ? (
          <>
            <p className="text-muted-foreground">
              {changing ? copy.subscribe.changeNote : copy.subscribe.trialNote}
            </p>
            <CheckoutForm
              orgSlug={org.slug}
              plans={plans}
              currentPlan={
                subscription.provider_plan_code ?? subscription.plan_code
              }
              needsCustomer={!subscription.provider_customer_id}
              defaultName={org.name}
              defaultEmail={typeof email === "string" ? email : ""}
            />
          </>
        ) : (
          <p className="text-muted-foreground">{copy.subscribe.none}</p>
        )}
      </div>
    </>
  );
}
