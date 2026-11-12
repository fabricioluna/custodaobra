import Link from "next/link";

import { orgPath } from "@/components/layout/nav";
import { getOrgRole, isOrgAdminRole } from "@/features/members/queries";
import { getSubscriptionState } from "@/lib/billing/limits";
import { BILLING_LIVE, TRIAL_WARNING_DAYS } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { billingCopy } from "../copy";

const copy = billingCopy.banner;

/**
 * Aviso no topo da área logada: teste acabando ou encerrado, mensalidade
 * atrasada, plano cancelado. Sem a cobrança no ar, só a conta cancelada
 * (que bloqueia mesmo assim) recebe aviso. O atalho para o plano aparece
 * para dono e admin.
 */
export async function BillingBanner({
  orgId,
  orgSlug,
}: {
  orgId: string;
  orgSlug: string;
}) {
  const supabase = await createClient();
  const [state, role] = await Promise.all([
    getSubscriptionState(supabase, orgId),
    getOrgRole(orgId),
  ]);
  if (!state) return null;

  let message: string | null = null;
  if (state.phase === "cancelled" && !state.usable) {
    message = copy.cancelled;
  } else if (!BILLING_LIVE) {
    return null;
  } else if (
    state.phase === "trial" &&
    state.daysLeft !== null &&
    state.daysLeft <= TRIAL_WARNING_DAYS
  ) {
    message = copy.trialEnding(state.daysLeft);
  } else if (state.phase === "trial_over") {
    message = copy.trialOver;
  } else if (state.phase === "past_due") {
    message = copy.pastDue;
  } else if (state.phase === "past_due_over") {
    message = copy.pastDueOver;
  }
  if (!message) return null;
  const blocked = !state.usable;

  return (
    <div
      role="status"
      className={cn(
        "mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 print:hidden",
        blocked
          ? "border-status-danger/40 bg-status-danger-soft text-status-danger"
          : "border-status-warn/40 bg-status-warn-soft text-status-warn",
      )}
    >
      <p className="font-medium">{message}</p>
      {isOrgAdminRole(role) ? (
        <Link
          href={orgPath(orgSlug, "configuracoes", "plano")}
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          {copy.action}
        </Link>
      ) : null}
    </div>
  );
}
