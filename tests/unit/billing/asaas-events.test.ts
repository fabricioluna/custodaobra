import { describe, expect, it } from "vitest";

import {
  asaasEventSchema,
  subscriptionPatch,
} from "@/lib/billing/asaas-events";

const row = {
  status: "trialing" as const,
  plan_code: "pessoal",
  current_period_end: null as string | null,
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
      value: 49.9,
    },
  });
const PRICE = 4990;

describe("subscriptionPatch (webhook do Asaas)", () => {
  it("pagamento confirmado: em dia, no plano escolhido, por um mês", () => {
    for (const event of ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]) {
      expect(
        subscriptionPatch(paymentEvent(event), row, undefined, PRICE),
      ).toEqual({
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

  it("evento antigo fora de ordem não mexe na conta", () => {
    // Pago até 21/01 (cobrança de 20/12); chega o "recebido" de 01/12.
    const paidAhead = {
      ...row,
      status: "active" as const,
      plan_code: "profissional",
      current_period_end: "2027-01-21T02:59:59+00:00",
    };
    expect(
      subscriptionPatch(paymentEvent("PAYMENT_RECEIVED"), paidAhead),
    ).toBeNull();
    // Atraso e estorno de uma cobrança cujo período já foi superado.
    expect(
      subscriptionPatch(paymentEvent("PAYMENT_OVERDUE"), paidAhead),
    ).toBeNull();
    expect(
      subscriptionPatch(paymentEvent("PAYMENT_REFUNDED"), paidAhead),
    ).toBeNull();
  });

  it("o mesmo pagamento confirmado e depois recebido aplica uma vez", () => {
    const first = subscriptionPatch(paymentEvent("PAYMENT_CONFIRMED"), row);
    const after = {
      ...row,
      status: "active" as const,
      current_period_end: first!.current_period_end!,
    };
    expect(
      subscriptionPatch(paymentEvent("PAYMENT_RECEIVED"), after),
    ).toBeNull();
  });

  it("pagar a cobrança atrasada volta a conta para em dia", () => {
    const overdue = {
      ...row,
      status: "past_due" as const,
      current_period_end: "2026-12-01T23:59:59-03:00",
    };
    expect(
      subscriptionPatch(paymentEvent("PAYMENT_RECEIVED"), overdue)?.status,
    ).toBe("active");
  });

  it("pagamento menor que o preço do plano guardado não troca o plano", () => {
    expect(
      subscriptionPatch(paymentEvent("PAYMENT_RECEIVED"), row, undefined, 9990),
    ).toMatchObject({ status: "active", plan_code: "pessoal" });
    // Preço desconhecido: não troca.
    expect(
      subscriptionPatch(paymentEvent("PAYMENT_RECEIVED"), row)?.plan_code,
    ).toBe("pessoal");
  });
});
