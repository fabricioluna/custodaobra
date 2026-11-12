import { z } from "zod";

import { addMonths } from "@/lib/dates";
import type { Database } from "@/types/database";

/**
 * Regras puras do webhook do Asaas: que mudança cada evento faz na
 * assinatura da conta. Só eventos da assinatura que a conta tem agora contam
 * (uma assinatura antiga, trocada ou cancelada, é ignorada).
 */

export const asaasEventSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  payment: z
    .object({
      id: z.string(),
      subscription: z.string().nullish(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status: z.string().optional(),
    })
    .optional(),
  subscription: z.object({ id: z.string() }).optional(),
});
export type AsaasEvent = z.infer<typeof asaasEventSchema>;

type SubscriptionRow = Pick<
  Database["public"]["Tables"]["subscriptions"]["Row"],
  "status" | "plan_code" | "provider_plan_code" | "provider_subscription_id"
>;
export type SubscriptionPatch = Partial<
  Pick<
    Database["public"]["Tables"]["subscriptions"]["Update"],
    | "status"
    | "plan_code"
    | "current_period_end"
    | "provider_subscription_id"
    | "provider_plan_code"
  >
>;

/** A assinatura do Asaas a que o evento se refere, se houver. */
export function eventSubscriptionId(event: AsaasEvent): string | null {
  return event.payment?.subscription ?? event.subscription?.id ?? null;
}

// Fim do dia no horário de Brasília (o Asaas trabalha com datas sem hora).
const endOfDay = (isoDate: string) => `${isoDate}T23:59:59-03:00`;

const PAID = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const REVERSED = new Set(["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"]);
const ENDED = new Set(["SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVATED"]);

export function subscriptionPatch(
  event: AsaasEvent,
  row: SubscriptionRow,
  now: Date = new Date(),
): SubscriptionPatch | null {
  const subscriptionId = eventSubscriptionId(event);
  if (!subscriptionId || subscriptionId !== row.provider_subscription_id) {
    return null;
  }

  if (ENDED.has(event.event)) {
    // Vale até o fim do período já pago (current_period_end fica).
    return {
      status: "cancelled",
      provider_subscription_id: null,
      provider_plan_code: null,
    };
  }

  const payment = event.payment;
  if (!payment) return null;

  if (PAID.has(event.event)) {
    // Pago: um mês a partir do vencimento da cobrança, no plano escolhido.
    return {
      status: "active",
      plan_code: row.provider_plan_code ?? row.plan_code,
      current_period_end: endOfDay(addMonths(payment.dueDate, 1)),
    };
  }

  if (row.status === "cancelled") return null;

  if (event.event === "PAYMENT_OVERDUE") {
    // A tolerância de atraso conta a partir do vencimento.
    return {
      status: "past_due",
      current_period_end: endOfDay(payment.dueDate),
    };
  }

  if (REVERSED.has(event.event)) {
    // Estorno ou contestação: o período pago deixa de valer agora.
    return { status: "past_due", current_period_end: now.toISOString() };
  }

  return null;
}
