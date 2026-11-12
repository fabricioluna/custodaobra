import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  adminClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

vi.mock("server-only", () => ({}));
const { canWrite, getPlanOverview } = await import("@/lib/billing/limits");

/**
 * Bloqueio suave e tela do plano: com a cobrança ainda desligada, teste
 * vencido não bloqueia; assinatura cancelada bloqueia criar coisas novas; o
 * resumo do plano conta obras, pessoas e convites, e o uso do mês.
 */
describe("plano e bloqueio suave", () => {
  const admin = adminClient();
  let ana: TestUser;
  let bruno: TestUser;

  beforeAll(async () => {
    ana = await createTestUser("plano-ana");
    bruno = await createTestUser("plano-bruno");
    const project = await ana.client
      .from("projects")
      .insert({ org_id: ana.orgId, name: "Casa", created_by: ana.id });
    if (project.error) throw project.error;
    await admin
      .from("organization_members")
      .insert({ org_id: ana.orgId, user_id: bruno.id, role: "admin" });
    await admin.rpc("increment_usage", {
      p_org_id: ana.orgId,
      p_month: "2026-11-01",
      p_whatsapp_entries: 2,
      p_ai_calls: 5,
    });
  });

  afterAll(async () => {
    await deleteTestUsers([ana, bruno]);
  });

  it("resumo do plano com o uso do mês", async () => {
    const overview = await getPlanOverview(ana.client, ana.orgId, "2026-11-15");
    expect(overview?.plan.code).toBe("pessoal");
    expect(overview?.state.phase).toBe("trial");
    expect(overview?.usage.projects).toEqual({ used: 1, limit: 1 });
    expect(overview?.usage.members.used).toBe(2);
    expect(overview?.usage.whatsappEntries.used).toBe(2);
    expect(overview?.usage.aiCalls.used).toBe(5);
    // Mês sem uso começa do zero.
    const next = await getPlanOverview(ana.client, ana.orgId, "2026-12-01");
    expect(next?.usage.aiCalls.used).toBe(0);
  });

  it("teste vencido não bloqueia enquanto a cobrança não está no ar", async () => {
    await admin
      .from("subscriptions")
      .update({ trial_ends_at: "2026-01-01T00:00:00Z" })
      .eq("org_id", ana.orgId);
    expect(await canWrite(ana.client, ana.orgId)).toEqual({ ok: true });
  });

  it("assinatura cancelada e vencida bloqueia criar coisas novas", async () => {
    await admin
      .from("subscriptions")
      .update({ status: "cancelled", current_period_end: null })
      .eq("org_id", ana.orgId);
    expect(await canWrite(ana.client, ana.orgId)).toEqual({
      ok: false,
      reason: "subscription_inactive",
    });
    // A conta do Bruno segue normal.
    expect(await canWrite(bruno.client, bruno.orgId)).toEqual({ ok: true });
  });
});
