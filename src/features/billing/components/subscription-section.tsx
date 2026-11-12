import Link from "next/link";

import { orgPath } from "@/components/layout/nav";
import { buttonVariants } from "@/components/ui/button";
import { APP_CONTACT_EMAIL } from "@/config/app";
import {
  type AsaasPayment,
  isAsaasConfigured,
  listOpenPayments,
} from "@/lib/billing/asaas";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import { billingCopy as copy } from "../copy";
import { getBillingSubscription, getPaidPlans } from "../queries";
import { CancelSubscriptionForm } from "./cancel-subscription-form";

/**
 * Assinar, pagar a fatura em aberto, trocar de plano e cancelar. Sem o Asaas
 * configurado ou sem plano pago, mostra o contato para mudar de plano.
 */
export async function SubscriptionSection({
  orgId,
  orgSlug,
  justCreated,
}: {
  orgId: string;
  orgSlug: string;
  justCreated: boolean;
}) {
  const [plans, subscription] = isAsaasConfigured()
    ? await Promise.all([getPaidPlans(), getBillingSubscription(orgId)])
    : [[], null];

  if (!plans.length || !subscription) {
    return (
      <p className="text-sm text-muted-foreground">
        {copy.page.changePlanSoon}{" "}
        <a
          href={`mailto:${APP_CONTACT_EMAIL}`}
          className="font-medium text-foreground underline underline-offset-2"
        >
          {APP_CONTACT_EMAIL}
        </a>
      </p>
    );
  }

  const subscribeHref = orgPath(orgSlug, "configuracoes", "plano", "assinar");
  const subscriptionId = subscription.provider_subscription_id;
  if (!subscriptionId) {
    return (
      <Link
        href={subscribeHref}
        className={cn(
          buttonVariants({ variant: "action", size: "lg" }),
          "self-start",
        )}
      >
        {copy.subscribe.start}
      </Link>
    );
  }

  let open: AsaasPayment | null = null;
  try {
    open = (await listOpenPayments(subscriptionId))[0] ?? null;
  } catch (error) {
    console.error("[cobrança] falha ao ler a fatura em aberto", error);
  }
  const nextPlan =
    subscription.provider_plan_code &&
    subscription.provider_plan_code !== subscription.plan_code
      ? plans.find((p) => p.code === subscription.provider_plan_code)
      : null;

  return (
    <div className="flex flex-col gap-4">
      {justCreated && !open ? (
        <p role="status" className="text-muted-foreground">
          {copy.subscription.created}
        </p>
      ) : null}
      {nextPlan ? (
        <p className="text-muted-foreground">
          {copy.subscription.nextPlan(nextPlan.name)}
        </p>
      ) : null}
      {open ? (
        <a
          href={open.invoiceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "action", size: "lg" }),
            "self-start",
          )}
        >
          {copy.subscription.openInvoice(
            formatCents(Math.round(open.value * 100)),
            formatDate(open.dueDate),
          )}
        </a>
      ) : null}
      <Link
        href={subscribeHref}
        className="self-start font-medium underline underline-offset-4"
      >
        {copy.subscribe.change}
      </Link>
      <details className="rounded-2xl border p-4">
        <summary className="min-h-11 cursor-pointer content-center font-medium">
          {copy.subscription.cancelTitle}
        </summary>
        <p className="mt-2 mb-4 text-sm text-muted-foreground">
          {copy.subscription.cancelDescription}
        </p>
        <CancelSubscriptionForm orgSlug={orgSlug} />
      </details>
    </div>
  );
}
