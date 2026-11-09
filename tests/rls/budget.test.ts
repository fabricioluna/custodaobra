import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

/**
 * Orçamento e progresso das etapas (update_stage_plan): só quem edita a obra
 * grava; convidado viewer e outra organização não mudam nada.
 */
describe("orçamento das etapas (RLS)", () => {
  let ana: TestUser;
  let bruno: TestUser;
  let carla: TestUser; // convidada viewer da obra da Ana
  let projectId: string;
  let stageIds: string[];

  const readStages = async () => {
    const { data } = await adminClient()
      .from("stages")
      .select("id, budget_cents, progress_percent")
      .eq("project_id", projectId)
      .order("sort_order");
    return data!;
  };

  beforeAll(async () => {
    ana = await createTestUser("orc-ana");
    bruno = await createTestUser("orc-bruno");
    carla = await createTestUser("orc-carla");

    const { data: project, error } = await ana.client
      .from("projects")
      .insert({ org_id: ana.orgId, name: "Casa da Ana", created_by: ana.id })
      .select("id")
      .single();
    if (error) throw error;
    projectId = project.id;
    stageIds = (await readStages()).map((stage) => stage.id);

    const admin = adminClient();
    await admin
      .from("organization_members")
      .insert({ org_id: ana.orgId, user_id: carla.id, role: "member" });
    await admin.from("project_members").insert({
      org_id: ana.orgId,
      project_id: projectId,
      user_id: carla.id,
      role: "viewer",
    });
  });

  afterAll(async () => {
    await deleteTestUsers([ana, bruno, carla]);
  });

  it("a dona grava orçamento e progresso de várias etapas de uma vez", async () => {
    const { data, error } = await ana.client.rpc("update_stage_plan", {
      p_project_id: projectId,
      p_items: [
        { stage_id: stageIds[0], budget_cents: 900_000 },
        { stage_id: stageIds[1], budget_cents: 600_000, progress_percent: 40 },
      ],
    });
    expect(error).toBeNull();
    expect(data).toBe(2);

    const stages = await readStages();
    expect(stages[0]).toMatchObject({
      budget_cents: 900_000,
      progress_percent: 0,
    });
    expect(stages[1]).toMatchObject({
      budget_cents: 600_000,
      progress_percent: 40,
    });
  });

  it("budget_cents nulo limpa; chave ausente não muda", async () => {
    await ana.client.rpc("update_stage_plan", {
      p_project_id: projectId,
      p_items: [
        { stage_id: stageIds[0], budget_cents: null },
        { stage_id: stageIds[1], progress_percent: 50 },
      ],
    });
    const stages = await readStages();
    expect(stages[0].budget_cents).toBeNull();
    expect(stages[1]).toMatchObject({
      budget_cents: 600_000,
      progress_percent: 50,
    });
  });

  it("recusa progresso fora de 0 a 100 e orçamento negativo", async () => {
    const progress = await ana.client.rpc("update_stage_plan", {
      p_project_id: projectId,
      p_items: [{ stage_id: stageIds[1], progress_percent: 101 }],
    });
    expect(progress.error).not.toBeNull();
    const budget = await ana.client.rpc("update_stage_plan", {
      p_project_id: projectId,
      p_items: [{ stage_id: stageIds[1], budget_cents: -1 }],
    });
    expect(budget.error).not.toBeNull();
  });

  it("convidada viewer não muda nada", async () => {
    const { data } = await carla.client.rpc("update_stage_plan", {
      p_project_id: projectId,
      p_items: [{ stage_id: stageIds[1], budget_cents: 1 }],
    });
    expect(data ?? 0).toBe(0);
    expect((await readStages())[1].budget_cents).toBe(600_000);
  });

  it("outra organização não muda nada", async () => {
    const { data } = await bruno.client.rpc("update_stage_plan", {
      p_project_id: projectId,
      p_items: [{ stage_id: stageIds[1], progress_percent: 100 }],
    });
    expect(data ?? 0).toBe(0);
    expect((await readStages())[1].progress_percent).toBe(50);
  });

  it("outra organização não grava o custo por m² da obra", async () => {
    await bruno.client
      .from("projects")
      .update({ cost_per_m2_cents: 1 })
      .eq("id", projectId);
    const { data } = await adminClient()
      .from("projects")
      .select("cost_per_m2_cents")
      .eq("id", projectId)
      .single();
    expect(data!.cost_per_m2_cents).toBeNull();
  });
});
