import { Check } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import { marketingCopy } from "../copy";
import { getPublicPlans } from "../plans";

const copy = marketingCopy.pricing;

/** Cartões dos planos, com os limites lidos da tabela `plans`. */
export async function Pricing() {
  const plans = await getPublicPlans();
  if (!plans.length) {
    return <p className="text-graphite">{copy.unavailable}</p>;
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {plans.map((plan) => {
        const features = [
          copy.projects(plan.max_projects),
          copy.members(plan.max_members),
          plan.whatsapp_enabled
            ? copy.whatsapp(plan.max_whatsapp_entries_month)
            : copy.noWhatsapp,
          ...(plan.whatsapp_enabled ? [copy.included] : []),
        ];
        return (
          <li
            key={plan.code}
            className="flex flex-col rounded-2xl border bg-card p-6 text-card-foreground"
          >
            <h3 className="text-2xl heading">{plan.name}</h3>
            {copy.highlights[plan.code] ? (
              <p className="mt-1 text-graphite">{copy.highlights[plan.code]}</p>
            ) : null}
            <p className="mt-5">
              {plan.price_cents_month > 0 ? (
                <>
                  <span className="text-3xl font-bold money">
                    {formatCents(plan.price_cents_month)}
                  </span>
                  <span className="text-graphite">{copy.perMonth}</span>
                </>
              ) : (
                <span className="text-2xl font-bold">{copy.free}</span>
              )}
            </p>
            {plan.trial_days > 0 ? (
              <p className="text-sm text-graphite">
                {copy.trial(plan.trial_days)}
              </p>
            ) : null}
            <ul className="mt-5 flex flex-1 flex-col gap-2">
              {features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check
                    aria-hidden
                    className="mt-0.5 size-5 shrink-0 text-status-ok"
                  />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href={LOGIN_PATH}
              className={cn(
                buttonVariants({ variant: "action", size: "lg" }),
                "mt-6",
              )}
            >
              {copy.cta}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
