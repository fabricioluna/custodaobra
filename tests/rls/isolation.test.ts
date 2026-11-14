import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

/**
 * Critério de aceite da Fase 0: um usuário de uma organização nunca lê nem
 * altera dados de outra.
 */
describe("isolamento entre organizações (RLS)", () => {
  let ana: TestUser;
  let bruno: TestUser;

  beforeAll(async () => {
    ana = await createTestUser("ana");
    bruno = await createTestUser("bruno");
  });

  afterAll(async () => {
    await deleteTestUsers([ana, bruno].filter(Boolean));
  });

  describe("cadastro", () => {
    it("cria organização pessoal com a pessoa como dona", async () => {
      const { data } = await ana.client
        .from("organization_members")
        .select("org_id, role")
        .eq("user_id", ana.id);
      expect(data).toEqual([{ org_id: ana.orgId, role: "owner" }]);
    });

    it("cria assinatura em teste no plano padrão", async () => {
      const { data } = await ana.client
        .from("subscriptions")
        .select("plan_code, status, trial_ends_at")
        .single();
      expect(data?.plan_code).toBe("pessoal");
      expect(data?.status).toBe("trialing");
      const days =
        (new Date(data?.trial_ends_at ?? 0).getTime() - Date.now()) /
        86_400_000;
      expect(Math.round(days)).toBe(7);
    });
  });

  describe("leitura", () => {
    it("cada um vê só a própria organização", async () => {
      const { data } = await ana.client.from("organizations").select("id");
      expect(data?.map((o) => o.id)).toEqual([ana.orgId]);
    });

    it("não acha a organização do outro nem pelo id", async () => {
      const { data } = await ana.client
        .from("organizations")
        .select("id")
        .eq("id", bruno.orgId);
      expect(data).toEqual([]);
    });

    it("não vê os membros da organização do outro", async () => {
      const { data } = await ana.client
        .from("organization_members")
        .select("user_id")
        .eq("org_id", bruno.orgId);
      expect(data).toEqual([]);
    });

    it("não vê a assinatura do outro", async () => {
      const { data } = await ana.client
        .from("subscriptions")
        .select("org_id")
        .eq("org_id", bruno.orgId);
      expect(data).toEqual([]);
    });

    it("não vê o perfil do outro", async () => {
      const { data } = await ana.client
        .from("profiles")
        .select("id")
        .eq("id", bruno.id);
      expect(data).toEqual([]);
    });
  });

  describe("escrita", () => {
    it("não renomeia a organização do outro", async () => {
      await ana.client
        .from("organizations")
        .update({ name: "Invadida" })
        .eq("id", bruno.orgId);

      const { data } = await adminClient()
        .from("organizations")
        .select("name")
        .eq("id", bruno.orgId)
        .single();
      expect(data?.name).toBe("Teste RLS bruno");
    });

    it("não se coloca como membro da organização do outro", async () => {
      const { error } = await ana.client
        .from("organization_members")
        .insert({ org_id: bruno.orgId, user_id: ana.id, role: "owner" });
      expect(error).not.toBeNull();
    });

    it("não troca a organização padrão para a do outro", async () => {
      const { error } = await ana.client
        .from("profiles")
        .update({ default_org_id: bruno.orgId })
        .eq("id", ana.id);
      expect(error).not.toBeNull();
    });

    it("não muda o próprio plano nem a assinatura", async () => {
      const { error } = await ana.client
        .from("subscriptions")
        .update({ plan_code: "profissional", status: "active" })
        .eq("org_id", ana.orgId);
      expect(error).not.toBeNull();
    });

    it("não cria organização por fora do cadastro", async () => {
      const { error } = await ana.client
        .from("organizations")
        .insert({ name: "Extra", slug: "extra-org-teste" });
      expect(error).not.toBeNull();
    });

    it("não muda o endereço (slug) da própria organização", async () => {
      const { error } = await ana.client
        .from("organizations")
        .update({ slug: "outro-endereco" })
        .eq("id", ana.orgId);
      expect(error).not.toBeNull();
    });

    it("dona renomeia a própria organização", async () => {
      const { data, error } = await ana.client
        .from("organizations")
        .update({ name: "Construtora Ana" })
        .eq("id", ana.orgId)
        .select("name")
        .single();
      expect(error).toBeNull();
      expect(data?.name).toBe("Construtora Ana");
    });

    it("não muda planos", async () => {
      const { error } = await ana.client
        .from("plans")
        .update({ price_cents_month: 1 })
        .eq("code", "pessoal");
      expect(error).not.toBeNull();
    });
  });

  describe("visitante sem login", () => {
    it("não lê organizações, perfis, membros nem assinaturas", async () => {
      const anon = anonClient();
      for (const table of [
        "organizations",
        "profiles",
        "organization_members",
        "subscriptions",
      ] as const) {
        const { data } = await anon.from(table).select("*").limit(1);
        expect(data ?? []).toEqual([]);
      }
    });

    it("lê os planos (página de preços)", async () => {
      const { data } = await anonClient().from("plans").select("code");
      expect(data?.map((p) => p.code).sort()).toEqual([
        "pessoal",
        "profissional",
      ]);
    });
  });
});
