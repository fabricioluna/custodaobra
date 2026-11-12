import { describe, expect, it } from "vitest";

import {
  asaasEventSchema,
  subscriptionPatch,
} from "@/lib/billing/asaas-events";

const row = {
  status: "trialing" as const,
  plan_code: "pessoal",
  provider_plan_code: "profissional",
  provider_subscription_id: "sub_1",
};

const paymentEvent = (event: string, subscription = "sub_1") =>
  asaasEventSchema.parse({
    id: `evt_${event}`,
    event,
    payment: {
      id: "pay_1",
      subscription,
      dueDate: "2026-12-01",
      status: "RECEIVED",
    },
  });

describe("subscriptionPatch (webhook do Asaas)", () => {
  it("pagamento confirmado: em dia, no plano escolhido, por um mês", () => {
    for (const event of ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]) {
      expect(subscriptionPatch(paymentEvent(event), row)).toEqual({
        status: "active",
        plan_code: "profissional",
        current_period_end: "2027-01-01T23:59:59-03:00",
      });
    }
  });

  it("atraso: tolerância contada do vencimento", () => {
    expect(subscriptionPatch(paymentEvent("PAYMENT_OVERDUE"), row)).toEqual({
      status: "past_due",
      current_period_end: "2026-12-01T23:59:59-03:00",
    });
  });

  it("estorno: o período pago acaba agora", () => {
    const now = new Date("2026-12-10T12:00:00Z");
    expect(
      subscriptionPatch(paymentEvent("PAYMENT_REFUNDED"), row, now),
    ).toEqual({ status: "past_due", current_period_end: now.toISOString() });
  });

  it("assinatura removida: cancelada, mantendo o período pago", () => {
    const event = asaasEventSchema.parse({
      id: "evt_del",
      event: "SUBSCRIPTION_DELETED",
      subscription: { id: "sub_1" },
    });
    expect(subscriptionPatch(event, row)).toEqual({
      status: "cancelled",
      provider_subscription_id: null,
      provider_plan_code: null,
    });
  });

  it("ignora outra assinatura, eventos sem efeito e atraso de conta cancelada", () => {
    expect(
      subscriptionPatch(paymentEvent("PAYMENT_RECEIVED", "sub_velha"), row),
    ).toBeNull();
    expect(subscriptionPatch(paymentEvent("PAYMENT_CREATED"), row)).toBeNull();
    expect(
      subscriptionPatch(paymentEvent("PAYMENT_OVERDUE"), {
        ...row,
        status: "cancelled",
      }),
    ).toBeNull();
  });

  it("sem plano novo guardado, mantém o atual", () => {
    expect(
      subscriptionPatch(paymentEvent("PAYMENT_RECEIVED"), {
        ...row,
        provider_plan_code: null,
      })?.plan_code,
    ).toBe("pessoal");
  });
});
