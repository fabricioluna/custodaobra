import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

/**
 * Obras, etapas, gastos, fornecedores, comprovantes e auditoria: ninguém de
 * fora da organização lê ou altera, e o convidado de uma obra só faz o que o
 * papel dele permite.
 */
describe("obras e gastos (RLS)", () => {
  let ana: TestUser;
  let bruno: TestUser;
  let carla: TestUser; // convidada para a obra da Ana
  let anaProjectId: string;
  let anaOtherProjectId: string;
  let anaStageId: string;
  let brunoProjectId: string;
  let brunoStageId: string;
  let materialId: string;
  let terrenoId: string;
  let anaExpenseId: string;

  beforeAll(async () => {
    ana = await createTestUser("obra-ana");
    bruno = await createTestUser("obra-bruno");
    carla = await createTestUser("obra-carla");

    const { data: categories } = await ana.client
      .from("categories")
      .select("id, code");
    materialId = categories!.find((c) => c.code === "material")!.id;
    terrenoId = categories!.find((c) => c.code === "terreno")!.id;

    const { data: anaProject, error } = await ana.client
      .from("projects")
      .insert({ org_id: ana.orgId, name: "Casa da Ana", created_by: ana.id })
      .select("id")
      .single();
    if (error) throw error;
    anaProjectId = anaProject.id;

    const { data: other } = await adminClient()
      .from("projects")
      .insert({ org_id: ana.orgId, name: "Reforma", created_by: ana.id })
      .select("id")
      .single();
    anaOtherProjectId = other!.id;

    const { data: brunoProject } = await bruno.client
      .from("projects")
      .insert({
        org_id: bruno.orgId,
        name: "Casa do Bruno",
        created_by: bruno.id,
      })
      .select("id")
      .single();
    brunoProjectId = brunoProject!.id;

    const { data: anaStages } = await ana.client
      .from("stages")
      .select("id")
      .eq("project_id", anaProjectId)
      .order("sort_order")
      .limit(1);
    anaStageId = anaStages![0].id;

    const { data: brunoStages } = await bruno.client
      .from("stages")
      .select("id")
      .eq("project_id", brunoProjectId)
      .limit(1);
    brunoStageId = brunoStages![0].id;

    const { data: expense, error: expenseError } = await ana.client
      .from("expenses")
      .insert({
        org_id: ana.orgId,
        project_id: anaProjectId,
        stage_id: anaStageId,
        category_id: materialId,
        description: "Cimento",
        amount_cents: 7800,
        spent_on: "2026-11-08",
        status: "confirmed",
        created_by: ana.id,
      })
      .select("id")
      .single();
    if (expenseError) throw expenseError;
    anaExpenseId = expense.id;

    // Carla entra na organização da Ana como member, só na primeira obra.
    const admin = adminClient();
    await admin
      .from("organization_members")
      .insert({ org_id: ana.orgId, user_id: carla.id, role: "member" });
    await admin.from("project_members").insert({
      org_id: ana.orgId,
      project_id: anaProjectId,
      user_id: carla.id,
      role: "viewer",
    });
  });

  afterAll(async () => {
    await deleteTestUsers([ana, bruno, carla].filter(Boolean));
  });

  describe("obra nova", () => {
    it("nasce com as 13 etapas padrão", async () => {
      const { data } = await ana.client
        .from("stages")
        .select("name, sort_order")
        .eq("project_id", anaProjectId)
        .order("sort_order");
      expect(data).toHaveLength(13);
      expect(data![0].name).toBe("Projetos e documentação");
      expect(data![12].name).toBe("Limpeza e entrega");
    });

    it("vê as 8 categorias padrão", async () => {
      const { data } = await ana.client.from("categories").select("code");
      expect(data).toHaveLength(8);
    });
  });

  describe("outra organização", () => {
    it("não vê obras, etapas nem gastos da Ana", async () => {
      const projects = await bruno.client
        .from("projects")
        .select("id")
        .eq("org_id", ana.orgId);
      const stages = await bruno.client
        .from("stages")
        .select("id")
        .eq("project_id", anaProjectId);
      const expenses = await bruno.client
        .from("expenses")
        .select("id")
        .eq("project_id", anaProjectId);
      expect(projects.data).toEqual([]);
      expect(stages.data).toEqual([]);
      expect(expenses.data).toEqual([]);
    });

    it("não vê os resumos da obra da Ana", async () => {
      const summary = await bruno.client
        .from("v_project_summary")
        .select("project_id")
        .eq("project_id", anaProjectId);
      const stages = await bruno.client
        .from("v_stage_summary")
        .select("stage_id")
        .eq("project_id", anaProjectId);
      expect(summary.data).toEqual([]);
      expect(stages.data).toEqual([]);
    });

    it("não cria obra na organização da Ana", async () => {
      const { error } = await bruno.client.from("projects").insert({
        org_id: ana.orgId,
        name: "Invasora",
        created_by: bruno.id,
      });
      expect(error).not.toBeNull();
    });

    it("não lança gasto na obra da Ana", async () => {
      const { error } = await bruno.client.from("expenses").insert({
        org_id: ana.orgId,
        project_id: anaProjectId,
        category_id: materialId,
        description: "Invasão",
        amount_cents: 100,
        spent_on: "2026-11-08",
        status: "confirmed",
        created_by: bruno.id,
      });
      expect(error).not.toBeNull();
    });

    it("não altera o gasto da Ana", async () => {
      await bruno.client
        .from("expenses")
        .update({ amount_cents: 1 })
        .eq("id", anaExpenseId);
      const { data } = await adminClient()
        .from("expenses")
        .select("amount_cents")
        .eq("id", anaExpenseId)
        .single();
      expect(data?.amount_cents).toBe(7800);
    });

    it("não vê fornecedores nem auditoria da Ana", async () => {
      await ana.client
        .from("suppliers")
        .insert({ org_id: ana.orgId, name: "Loja do Zé" });
      const suppliers = await bruno.client
        .from("suppliers")
        .select("id")
        .eq("org_id", ana.orgId);
      const audit = await bruno.client
        .from("audit_log")
        .select("id")
        .eq("org_id", ana.orgId);
      expect(suppliers.data).toEqual([]);
      expect(audit.data).toEqual([]);
    });
  });

  describe("regras de integridade", () => {
    it("não aceita etapa de outra obra no gasto", async () => {
      const { error } = await ana.client.from("expenses").insert({
        org_id: ana.orgId,
        project_id: anaProjectId,
        stage_id: brunoStageId,
        category_id: materialId,
        description: "Etapa errada",
        amount_cents: 100,
        spent_on: "2026-11-08",
        status: "confirmed",
        created_by: ana.id,
      });
      expect(error).not.toBeNull();
    });

    it("não aceita gasto em nome de outra pessoa", async () => {
      const { error } = await ana.client.from("expenses").insert({
        org_id: ana.orgId,
        project_id: anaProjectId,
        category_id: materialId,
        description: "Autor falso",
        amount_cents: 100,
        spent_on: "2026-11-08",
        status: "confirmed",
        created_by: bruno.id,
      });
      expect(error).not.toBeNull();
    });

    it("não apaga gasto de verdade (só exclusão lógica)", async () => {
      await ana.client.from("expenses").delete().eq("id", anaExpenseId);
      const { data } = await adminClient()
        .from("expenses")
        .select("id")
        .eq("id", anaExpenseId);
      expect(data).toHaveLength(1);
    });

    it("não muda a obra de um gasto", async () => {
      const { error } = await ana.client
        .from("expenses")
        .update({ project_id: anaOtherProjectId })
        .eq("id", anaExpenseId);
      expect(error).not.toBeNull();
    });

    it("não escreve direto na auditoria", async () => {
      const { error } = await ana.client.from("audit_log").insert({
        org_id: ana.orgId,
        entity: "expenses",
        entity_id: anaExpenseId,
        action: "delete",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("resumos e auditoria", () => {
    it("separa construção e terreno no resumo da obra", async () => {
      await ana.client.from("expenses").insert({
        org_id: ana.orgId,
        project_id: anaProjectId,
        category_id: terrenoId,
        description: "ITBI",
        amount_cents: 500000,
        spent_on: "2026-11-01",
        status: "confirmed",
        created_by: ana.id,
      });
      // Pendente não entra em nenhum total.
      await ana.client.from("expenses").insert({
        org_id: ana.orgId,
        project_id: anaProjectId,
        category_id: materialId,
        description: "Pendente",
        amount_cents: 99900,
        spent_on: "2026-11-08",
        status: "pending",
        created_by: ana.id,
      });

      const { data } = await ana.client
        .from("v_project_summary")
        .select("construction_cents, land_cents")
        .eq("project_id", anaProjectId)
        .single();
      expect(data).toEqual({ construction_cents: 7800, land_cents: 500000 });

      const { data: stage } = await ana.client
        .from("v_stage_summary")
        .select("spent_cents")
        .eq("stage_id", anaStageId)
        .single();
      expect(stage?.spent_cents).toBe(7800);
    });

    it("registra criação e exclusão lógica na auditoria", async () => {
      const { error } = await ana.client
        .from("expenses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", anaExpenseId);
      expect(error).toBeNull();

      const { data } = await ana.client
        .from("audit_log")
        .select("action, user_id")
        .eq("entity", "expenses")
        .eq("entity_id", anaExpenseId)
        .order("created_at");
      expect(data?.map((row) => row.action)).toEqual(["create", "delete"]);
      expect(data?.every((row) => row.user_id === ana.id)).toBe(true);

      // Volta o gasto para os próximos testes.
      await ana.client
        .from("expenses")
        .update({ deleted_at: null })
        .eq("id", anaExpenseId);
    });
  });

  describe("convidada viewer de uma obra", () => {
    it("vê só a obra para a qual foi convidada", async () => {
      const { data } = await carla.client
        .from("projects")
        .select("id")
        .eq("org_id", ana.orgId);
      expect(data?.map((p) => p.id)).toEqual([anaProjectId]);
    });

    it("vê os gastos dessa obra", async () => {
      const { data } = await carla.client
        .from("expenses")
        .select("id")
        .eq("id", anaExpenseId);
      expect(data).toHaveLength(1);
    });

    it("não lança, não edita e não cria obra", async () => {
      const insert = await carla.client.from("expenses").insert({
        org_id: ana.orgId,
        project_id: anaProjectId,
        category_id: materialId,
        description: "Viewer",
        amount_cents: 100,
        spent_on: "2026-11-08",
        status: "confirmed",
        created_by: carla.id,
      });
      expect(insert.error).not.toBeNull();

      await carla.client
        .from("expenses")
        .update({ amount_cents: 1 })
        .eq("id", anaExpenseId);
      const { data } = await adminClient()
        .from("expenses")
        .select("amount_cents")
        .eq("id", anaExpenseId)
        .single();
      expect(data?.amount_cents).toBe(7800);

      const project = await carla.client.from("projects").insert({
        org_id: ana.orgId,
        name: "Obra da Carla",
        created_by: carla.id,
      });
      expect(project.error).not.toBeNull();

      const stage = await carla.client
        .from("stages")
        .update({ name: "Renomeada" })
        .eq("id", anaStageId)
        .select("id");
      expect(stage.data ?? []).toEqual([]);
    });

    it("não vê a auditoria da organização", async () => {
      const { data } = await carla.client
        .from("audit_log")
        .select("id")
        .eq("org_id", ana.orgId);
      expect(data).toEqual([]);
    });

    it("como editor, lança gasto na obra", async () => {
      await adminClient()
        .from("project_members")
        .update({ role: "editor" })
        .eq("project_id", anaProjectId)
        .eq("user_id", carla.id);

      const { error } = await carla.client.from("expenses").insert({
        org_id: ana.orgId,
        project_id: anaProjectId,
        category_id: materialId,
        description: "Areia",
        amount_cents: 25000,
        spent_on: "2026-11-08",
        status: "confirmed",
        created_by: carla.id,
      });
      expect(error).toBeNull();

      // Mas continua sem acesso à outra obra.
      const other = await carla.client.from("expenses").insert({
        org_id: ana.orgId,
        project_id: anaOtherProjectId,
        category_id: materialId,
        description: "Outra obra",
        amount_cents: 100,
        spent_on: "2026-11-08",
        status: "confirmed",
        created_by: carla.id,
      });
      expect(other.error).not.toBeNull();
    });
  });

  describe("comprovantes (storage)", () => {
    const file = () =>
      new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
        type: "image/jpeg",
      });

    it("a dona envia e baixa o comprovante do próprio gasto", async () => {
      const path = `${ana.orgId}/${anaExpenseId}/cupom.jpg`;
      const upload = await ana.client.storage
        .from("comprovantes")
        .upload(path, file(), { contentType: "image/jpeg" });
      expect(upload.error).toBeNull();

      const signed = await ana.client.storage
        .from("comprovantes")
        .createSignedUrl(path, 60);
      expect(signed.error).toBeNull();
    });

    it("outra organização não envia nem baixa", async () => {
      const path = `${ana.orgId}/${anaExpenseId}/invasao.jpg`;
      const upload = await bruno.client.storage
        .from("comprovantes")
        .upload(path, file(), { contentType: "image/jpeg" });
      expect(upload.error).not.toBeNull();

      const signed = await bruno.client.storage
        .from("comprovantes")
        .createSignedUrl(`${ana.orgId}/${anaExpenseId}/cupom.jpg`, 60);
      expect(signed.error).not.toBeNull();
    });

    it("não envia fora do padrão org/gasto/arquivo", async () => {
      const upload = await ana.client.storage
        .from("comprovantes")
        .upload(`${ana.orgId}/solto.jpg`, file(), {
          contentType: "image/jpeg",
        });
      expect(upload.error).not.toBeNull();
    });

    it("limpa os arquivos de teste", async () => {
      const { error } = await adminClient()
        .storage.from("comprovantes")
        .remove([`${ana.orgId}/${anaExpenseId}/cupom.jpg`]);
      expect(error).toBeNull();
    });
  });

  describe("visitante sem login", () => {
    it("não lê nada das tabelas novas", async () => {
      const anon = anonClient();
      for (const table of [
        "projects",
        "stages",
        "expenses",
        "suppliers",
        "categories",
        "attachments",
        "audit_log",
      ] as const) {
        const { data } = await anon.from(table).select("*").limit(1);
        expect(data ?? []).toEqual([]);
      }
    });
  });

  it("apagar a organização leva junto obras, gastos e auditoria", async () => {
    const temp = await createTestUser("obra-temp");
    const { data: project } = await temp.client
      .from("projects")
      .insert({ org_id: temp.orgId, name: "Temporária", created_by: temp.id })
      .select("id")
      .single();
    await temp.client.from("expenses").insert({
      org_id: temp.orgId,
      project_id: project!.id,
      category_id: materialId,
      description: "Brita",
      amount_cents: 100,
      spent_on: "2026-11-08",
      status: "confirmed",
      created_by: temp.id,
    });

    const admin = adminClient();
    await admin.auth.admin.deleteUser(temp.id);
    const { error } = await admin
      .from("organizations")
      .delete()
      .eq("id", temp.orgId);
    expect(error).toBeNull();

    const { data: audit } = await admin
      .from("audit_log")
      .select("id")
      .eq("org_id", temp.orgId);
    expect(audit).toEqual([]);
  });
});
