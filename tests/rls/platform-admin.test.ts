import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

/**
 * Painel interno: só quem está em platform_admins lista as contas; ninguém
 * se inclui sozinho nem lê a lista da equipe pelo app.
 */
describe("painel interno", () => {
  const admin = adminClient();
  let equipe: TestUser;
  let cliente: TestUser;
  const month = "2026-11-01";

  beforeAll(async () => {
    equipe = await createTestUser("painel-equipe");
    cliente = await createTestUser("painel-cliente");
    const { error } = await admin
      .from("platform_admins")
      .insert({ user_id: equipe.id });
    if (error) throw error;
  });

  afterAll(async () => {
    await deleteTestUsers([equipe, cliente]);
  });

  it("a equipe vê todas as contas, com plano e dono", async () => {
    const { data, error } = await equipe.client.rpc("admin_orgs", {
      p_month: month,
    });
    expect(error).toBeNull();
    const row = data?.find((org) => org.org_id === cliente.orgId);
    expect(row?.owner_email).toBe(cliente.email);
    expect(row?.plan_code).toBe("pessoal");
    expect(row?.status).toBe("trialing");

    // Uma conta só, para a página de detalhe.
    const one = await equipe.client.rpc("admin_orgs", {
      p_month: month,
      p_org_id: cliente.orgId,
    });
    expect(one.error).toBeNull();
    expect(one.data?.map((org) => org.org_id)).toEqual([cliente.orgId]);
  });

  it("cliente e visitante não listam as contas", async () => {
    const asClient = await cliente.client.rpc("admin_orgs", { p_month: month });
    expect(asClient.error?.code).toBe("42501");
    const asAnon = await anonClient().rpc("admin_orgs", { p_month: month });
    expect(asAnon.error).not.toBeNull();
  });

  it("ninguém se inclui na equipe nem lê a lista pelo app", async () => {
    const insert = await cliente.client
      .from("platform_admins")
      .insert({ user_id: cliente.id });
    expect(insert.error).not.toBeNull();
    const read = await equipe.client.from("platform_admins").select("user_id");
    expect(read.error).not.toBeNull();
  });

  it("a equipe libera, bloqueia e troca o plano; o motivo fica só com ela", async () => {
    const block = await equipe.client.rpc("admin_set_access", {
      p_org_id: cliente.orgId,
      p_mode: "blocked",
      p_note: "teste do painel",
      p_plan_code: "profissional",
    });
    expect(block.error).toBeNull();

    const { data: sub } = await cliente.client
      .from("subscriptions")
      .select("access_override, access_override_at, plan_code")
      .eq("org_id", cliente.orgId)
      .single();
    expect(sub).toEqual({
      access_override: "blocked",
      access_override_at: null,
      plan_code: "profissional",
    });

    const { data: rows } = await equipe.client.rpc("admin_orgs", {
      p_month: month,
    });
    const row = rows?.find((org) => org.org_id === cliente.orgId);
    expect(row?.access_note).toBe("teste do painel");

    // A conta não lê o motivo; a auditoria registra a mudança sem ele.
    const notes = await cliente.client.from("admin_org_notes").select("note");
    expect(notes.error).not.toBeNull();
    const { data: audit } = await cliente.client
      .from("audit_log")
      .select("diff")
      .eq("org_id", cliente.orgId)
      .eq("entity", "subscription_access");
    expect(audit?.length).toBe(1);
    expect(JSON.stringify(audit?.[0]?.diff)).not.toContain("teste do painel");

    const until = "2026-12-02T03:00:00.000Z";
    const free = await equipe.client.rpc("admin_set_access", {
      p_org_id: cliente.orgId,
      p_mode: "free",
      p_at: until,
    });
    expect(free.error).toBeNull();
    const normal = await equipe.client.rpc("admin_set_access", {
      p_org_id: cliente.orgId,
    });
    expect(normal.error).toBeNull();
    const { data: after } = await admin
      .from("subscriptions")
      .select("access_override, access_override_at")
      .eq("org_id", cliente.orgId)
      .single();
    expect(after).toEqual({ access_override: null, access_override_at: null });
  });

  it("plano que não existe é recusado", async () => {
    const { error } = await equipe.client.rpc("admin_set_access", {
      p_org_id: cliente.orgId,
      p_mode: "free",
      p_plan_code: "nao-existe",
    });
    expect(error?.code).toBe("22023");
  });

  it("o dono da conta não se libera nem mexe no acesso", async () => {
    const rpc = await cliente.client.rpc("admin_set_access", {
      p_org_id: cliente.orgId,
      p_mode: "free",
    });
    expect(rpc.error?.code).toBe("42501");
    const update = await cliente.client
      .from("subscriptions")
      .update({ access_override: "free" })
      .eq("org_id", cliente.orgId)
      .select("id");
    expect(update.data ?? []).toHaveLength(0);
    const anon = await anonClient().rpc("admin_set_access", {
      p_org_id: cliente.orgId,
      p_mode: "free",
    });
    expect(anon.error).not.toBeNull();
  });
});
