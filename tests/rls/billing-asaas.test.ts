import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  adminClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

vi.mock("server-only", () => ({}));
const { processAsaasEvent } = await import("@/lib/billing/asaas-webhook");
const { asaasEventSchema } = await import("@/lib/billing/asaas-events");

/**
 * Cobrança pelo Asaas: só dono e admin guardam cliente e assinatura (e só da
 * própria conta); ninguém lê os eventos pelo app; o webhook aplica o
 * pagamento na conta certa e não processa o mesmo evento duas vezes.
 */
describe("cobrança pelo Asaas", () => {
  const admin = adminClient();
  const plan = `teste_pago_${Date.now()}`;
  const subscriptionId = `sub_teste_${Date.now()}`;
  const eventIds: string[] = [];
  let ana: TestUser;
  let bruno: TestUser;
  let carla: TestUser;

  beforeAll(async () => {
    ana = await createTestUser("asaas-ana");
    bruno = await createTestUser("asaas-bruno");
    carla = await createTestUser("asaas-carla");
    const inserted = await admin.from("plans").insert({
      code: plan,
      name: "Teste pago",
      max_projects: 5,
      max_members: 5,
      max_whatsapp_entries_month: 100,
      max_ai_calls_month: 100,
      price_cents_month: 1990,
    });
    if (inserted.error) throw inserted.error;
    // Bruno é membro comum da conta da Ana.
    const member = await admin
      .from("organization_members")
      .insert({ org_id: ana.orgId, user_id: bruno.id, role: "member" });
    if (member.error) throw member.error;
  });

  afterAll(async () => {
    await admin.from("billing_events").delete().in("id", eventIds);
    await deleteTestUsers([ana, bruno, carla]);
    await admin.from("plans").delete().eq("code", plan);
  });

  it("membro comum e outra conta não mexem na cobrança", async () => {
    const asMember = await bruno.client.rpc("billing_set_customer", {
      p_org_id: ana.orgId,
      p_customer_id: "cus_bruno",
    });
    expect(asMember.error?.code).toBe("42501");
    const otherOrg = await carla.client.rpc("billing_set_customer", {
      p_org_id: ana.orgId,
      p_customer_id: "cus_carla",
    });
    expect(otherOrg.error?.code).toBe("42501");
    const cancel = await carla.client.rpc("billing_mark_cancelled", {
      p_org_id: ana.orgId,
    });
    expect(cancel.error?.code).toBe("42501");
  });

  it("dono guarda cliente e assinatura; plano sem preço é recusado", async () => {
    const noCustomer = await ana.client.rpc("billing_set_subscription", {
      p_org_id: ana.orgId,
      p_subscription_id: subscriptionId,
      p_plan_code: plan,
    });
    expect(noCustomer.error).not.toBeNull();

    const customer = await ana.client.rpc("billing_set_customer", {
      p_org_id: ana.orgId,
      p_customer_id: "cus_ana",
    });
    expect(customer.error).toBeNull();
    // Não troca o cliente já guardado.
    const other = await ana.client.rpc("billing_set_customer", {
      p_org_id: ana.orgId,
      p_customer_id: "cus_outro",
    });
    expect(other.error).not.toBeNull();

    const free = await ana.client.rpc("billing_set_subscription", {
      p_org_id: ana.orgId,
      p_subscription_id: subscriptionId,
      p_plan_code: "pessoal",
    });
    expect(free.error?.code).toBe("22023");

    const paid = await ana.client.rpc("billing_set_subscription", {
      p_org_id: ana.orgId,
      p_subscription_id: subscriptionId,
      p_plan_code: plan,
    });
    expect(paid.error).toBeNull();

    const { data } = await ana.client
      .from("subscriptions")
      .select("plan_code, provider, provider_customer_id, provider_plan_code")
      .eq("org_id", ana.orgId)
      .single();
    // O plano só muda com o pagamento.
    expect(data).toEqual({
      plan_code: "pessoal",
      provider: "asaas",
      provider_customer_id: "cus_ana",
      provider_plan_code: plan,
    });
  });

  it("a mesma assinatura do Asaas não serve para outra conta", async () => {
    await carla.client.rpc("billing_set_customer", {
      p_org_id: carla.orgId,
      p_customer_id: "cus_carla",
    });
    const stolen = await carla.client.rpc("billing_set_subscription", {
      p_org_id: carla.orgId,
      p_subscription_id: subscriptionId,
      p_plan_code: plan,
    });
    expect(stolen.error).not.toBeNull();
  });

  it("ninguém lê os eventos do Asaas pelo app", async () => {
    const { data, error } = await ana.client
      .from("billing_events")
      .select("id");
    expect(error !== null || data?.length === 0).toBe(true);
  });

  it("pagamento confirmado: conta em dia no plano novo, uma vez só", async () => {
    const id = `evt_pago_${Date.now()}`;
    eventIds.push(id);
    const payload = {
      id,
      event: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_1",
        subscription: subscriptionId,
        dueDate: "2026-11-20",
        status: "RECEIVED",
      },
    };
    const event = asaasEventSchema.parse(payload);
    expect(await processAsaasEvent(admin, event, payload)).toBe("updated");
    expect(await processAsaasEvent(admin, event, payload)).toBe("duplicate");

    const { data } = await admin
      .from("subscriptions")
      .select("status, plan_code, current_period_end")
      .eq("org_id", ana.orgId)
      .single();
    expect(data?.status).toBe("active");
    expect(data?.plan_code).toBe(plan);
    expect(new Date(data!.current_period_end!).toISOString()).toBe(
      "2026-12-21T02:59:59.000Z",
    );
    const stored = await admin
      .from("billing_events")
      .select("org_id, processed_at")
      .eq("id", id)
      .single();
    expect(stored.data?.org_id).toBe(ana.orgId);
    expect(stored.data?.processed_at).not.toBeNull();
  });

  it("evento de assinatura desconhecida fica anotado e não mexe em nada", async () => {
    const id = `evt_outra_${Date.now()}`;
    eventIds.push(id);
    const payload = {
      id,
      event: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_2",
        subscription: "sub_de_ninguem",
        dueDate: "2026-11-20",
      },
    };
    expect(
      await processAsaasEvent(admin, asaasEventSchema.parse(payload), payload),
    ).toBe("unknown_subscription");
  });

  it("dono cancela: fica cancelada e o período pago continua", async () => {
    const { error } = await ana.client.rpc("billing_mark_cancelled", {
      p_org_id: ana.orgId,
    });
    expect(error).toBeNull();
    const { data } = await admin
      .from("subscriptions")
      .select("status, provider_subscription_id, current_period_end")
      .eq("org_id", ana.orgId)
      .single();
    expect(data?.status).toBe("cancelled");
    expect(data?.provider_subscription_id).toBeNull();
    expect(data?.current_period_end).not.toBeNull();
  });
});
