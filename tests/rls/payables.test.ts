import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

/**
 * Contas a pagar: isolamento entre organizações, convidado viewer só vê,
 * "marcar como paga" cria o gasto, e excluir o gasto reabre a conta.
 */
describe("contas a pagar (RLS)", () => {
  let ana: TestUser;
  let bruno: TestUser;
  let carla: TestUser; // convidada viewer da obra da Ana
  let projectId: string;
  let stageId: string;
  let materialId: string;
  let terrenoId: string;

  const newPayable = (
    overrides: Partial<{
      amount_cents: number;
      due_date: string;
      category_id: string;
      stage_id: string | null;
    }> = {},
  ) => ({
    org_id: ana.orgId,
    project_id: projectId,
    stage_id: stageId,
    category_id: materialId,
    description: "Boleto da madeira",
    amount_cents: 150_000,
    due_date: "2026-12-10",
    created_by: ana.id,
    ...overrides,
  });

  const committedOfStage = async () => {
    const { data } = await ana.client
      .from("v_stage_summary")
      .select("committed_cents, spent_cents")
      .eq("stage_id", stageId)
      .single();
    return data!;
  };

  beforeAll(async () => {
    ana = await createTestUser("pag-ana");
    bruno = await createTestUser("pag-bruno");
    carla = await createTestUser("pag-carla");

    const { data: project, error } = await ana.client
      .from("projects")
      .insert({ org_id: ana.orgId, name: "Casa da Ana", created_by: ana.id })
      .select("id")
      .single();
    if (error) throw error;
    projectId = project.id;

    const admin = adminClient();
    const { data: stages } = await admin
      .from("stages")
      .select("id")
      .eq("project_id", projectId)
      .order("sort_order")
      .limit(1);
    stageId = stages![0].id;
    const { data: categories } = await admin
      .from("categories")
      .select("id, code")
      .is("org_id", null);
    materialId = categories!.find((c) => c.code === "material")!.id;
    terrenoId = categories!.find((c) => c.code === "terreno")!.id;

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

  it("a dona cadastra parcelas e elas entram no 'a pagar' da etapa", async () => {
    const group = crypto.randomUUID();
    const { error } = await ana.client.from("payables").insert([
      {
        ...newPayable({ amount_cents: 100_000 }),
        installment_group_id: group,
        installment_number: 1,
        installment_total: 2,
      },
      {
        ...newPayable({ amount_cents: 100_000, due_date: "2027-01-10" }),
        installment_group_id: group,
        installment_number: 2,
        installment_total: 2,
      },
      // Terreno não entra no comprometido das etapas.
      newPayable({ amount_cents: 999_000, category_id: terrenoId }),
    ]);
    expect(error).toBeNull();
    expect((await committedOfStage()).committed_cents).toBe(200_000);
  });

  it("não cadastra conta já paga nem parcela incoerente", async () => {
    const paid = await ana.client
      .from("payables")
      .insert({ ...newPayable(), status: "paid" });
    expect(paid.error).not.toBeNull();

    const wrong = await ana.client.from("payables").insert({
      ...newPayable(),
      installment_group_id: crypto.randomUUID(),
      installment_number: 3,
      installment_total: 2,
    });
    expect(wrong.error).not.toBeNull();
  });

  it("outra organização não vê nem cadastra contas na obra", async () => {
    const { data } = await bruno.client
      .from("payables")
      .select("id")
      .eq("project_id", projectId);
    expect(data).toEqual([]);

    const { error } = await bruno.client
      .from("payables")
      .insert({ ...newPayable(), org_id: ana.orgId, created_by: bruno.id });
    expect(error).not.toBeNull();
  });

  it("a convidada viewer vê, mas não cadastra, edita nem paga", async () => {
    const { data } = await carla.client
      .from("payables")
      .select("id")
      .eq("project_id", projectId);
    expect(data?.length).toBeGreaterThan(0);
    const target = data![0].id;

    const insert = await carla.client
      .from("payables")
      .insert({ ...newPayable(), created_by: carla.id });
    expect(insert.error).not.toBeNull();

    const update = await carla.client
      .from("payables")
      .update({ amount_cents: 1 })
      .eq("id", target)
      .select("id");
    expect(update.data ?? []).toEqual([]);

    const pay = await carla.client.rpc("pay_payable", {
      p_payable_id: target,
      p_paid_on: "2026-11-09",
    });
    expect(pay.error).not.toBeNull();
  });

  it("não marca como paga sem o gasto do pagamento", async () => {
    const { data: payable } = await ana.client
      .from("payables")
      .insert(newPayable())
      .select("id")
      .single();
    const { error } = await ana.client
      .from("payables")
      .update({ status: "paid" })
      .eq("id", payable!.id);
    expect(error).not.toBeNull();
  });

  it("pagar cria o gasto, tira do 'a pagar' e excluir o gasto reabre a conta", async () => {
    const { data: payable } = await ana.client
      .from("payables")
      .insert(newPayable({ amount_cents: 50_000 }))
      .select("id")
      .single();
    const before = await committedOfStage();

    const { data: expenseId, error } = await ana.client.rpc("pay_payable", {
      p_payable_id: payable!.id,
      p_paid_on: "2026-11-09",
      p_amount_cents: 52_000, // com juros
      p_payment_method: "boleto",
    });
    expect(error).toBeNull();

    const { data: expense } = await ana.client
      .from("expenses")
      .select("amount_cents, status, payable_id, spent_on, created_by")
      .eq("id", expenseId!)
      .single();
    expect(expense).toMatchObject({
      amount_cents: 52_000,
      status: "confirmed",
      payable_id: payable!.id,
      spent_on: "2026-11-09",
      created_by: ana.id,
    });

    const after = await committedOfStage();
    expect(after.committed_cents).toBe((before.committed_cents ?? 0) - 50_000);
    expect(after.spent_cents).toBe((before.spent_cents ?? 0) + 52_000);

    // Pagar de novo não duplica.
    const again = await ana.client.rpc("pay_payable", {
      p_payable_id: payable!.id,
      p_paid_on: "2026-11-09",
    });
    expect(again.error).not.toBeNull();

    await ana.client
      .from("expenses")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", expenseId!);
    const { data: reopened } = await ana.client
      .from("payables")
      .select("status, paid_expense_id")
      .eq("id", payable!.id)
      .single();
    expect(reopened).toEqual({ status: "open", paid_expense_id: null });
  });

  it("outra organização não paga a conta", async () => {
    const { data: payable } = await ana.client
      .from("payables")
      .insert(newPayable())
      .select("id")
      .single();
    const { error } = await bruno.client.rpc("pay_payable", {
      p_payable_id: payable!.id,
      p_paid_on: "2026-11-09",
    });
    expect(error).not.toBeNull();

    const { data } = await adminClient()
      .from("payables")
      .select("status")
      .eq("id", payable!.id)
      .single();
    expect(data?.status).toBe("open");
  });
});
