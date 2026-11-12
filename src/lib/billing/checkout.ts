import { todayIn } from "@/lib/dates";

/**
 * Vencimento da primeira cobrança de uma assinatura nova: hoje, ou o fim do
 * teste grátis ou do período já pago, o que vier depois (quem assina no
 * meio do teste não perde os dias que faltam).
 */
export function firstDueDate(
  subscription: {
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
  },
  timezone: string,
  now: Date = new Date(),
): string {
  const candidates = [todayIn(timezone, now)];
  if (subscription.trial_ends_at) {
    candidates.push(todayIn(timezone, new Date(subscription.trial_ends_at)));
  }
  if (
    subscription.current_period_end &&
    (subscription.status === "active" || subscription.status === "cancelled")
  ) {
    candidates.push(
      todayIn(timezone, new Date(subscription.current_period_end)),
    );
  }
  return candidates.sort().at(-1)!;
}
