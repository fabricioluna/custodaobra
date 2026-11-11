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
});
