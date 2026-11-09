import { expect, test } from "@playwright/test";

import { adminClient } from "../rls/helpers";
import { createE2EUser, deleteE2EUsers, type E2EUser, signIn } from "./helpers";

/**
 * Fase 2, parte 1: orçamento por estimativa, previsto x realizado com alerta
 * e progresso informado.
 */
test.describe("orçamento e previsto x realizado", () => {
  const users: E2EUser[] = [];

  test.afterAll(async () => {
    await deleteE2EUsers(users);
  });

  test("estima, salva, alerta e acompanha o progresso", async ({ page }) => {
    const user = await createE2EUser("orcamento");
    users.push(user);
    const admin = adminClient();
    await admin
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", user.id);
    const { data: project } = await admin
      .from("projects")
      .insert({
        org_id: user.orgId,
        name: "Casa Orçada",
        built_area_m2: 100,
        created_by: user.id,
      })
      .select("id")
      .single();

    await signIn(page, user);
    await expect(
      page.getByRole("heading", { level: 1, name: "Casa Orçada" }),
    ).toBeVisible();
    const projectUrl = page.url();

    // Estimativa: 100 m² × R$ 2.000,00 = R$ 200.000,00.
    await page.goto(`${projectUrl}/etapas`);
    await expect(page.getByText("Sem orçamento ainda")).toBeVisible();
    await page.getByRole("link", { name: "Definir orçamento" }).click();
    await expect(page.getByLabel("Área construída (m²)")).toHaveValue("100");
    await page.getByLabel("Custo por m²").fill("200000");
    await expect(page.getByText("Estimativa: R$ 200.000,00")).toBeVisible();
    await page.getByRole("button", { name: "Preencher as etapas" }).click();
    // Fundação = 8% = R$ 16.000,00.
    await expect(page.getByLabel("Previsto para Fundação")).toHaveValue(
      "R$ 16.000,00",
    );
    await expect(page.getByText("R$ 200.000,00").last()).toBeVisible();
    await page.getByRole("button", { name: "Salvar orçamento" }).click();
    await expect(page.getByText("Orçamento salvo.")).toBeVisible();

    const { data: saved } = await admin
      .from("projects")
      .select("cost_per_m2_cents")
      .eq("id", project!.id)
      .single();
    expect(saved!.cost_per_m2_cents).toBe(200000);

    // Gasto de R$ 15.000,00 na Fundação: 94% do previsto, obra a 0%.
    const { data: stage } = await admin
      .from("stages")
      .select("id")
      .eq("project_id", project!.id)
      .eq("name", "Fundação")
      .single();
    const { data: material } = await admin
      .from("categories")
      .select("id")
      .eq("code", "material")
      .is("org_id", null)
      .single();
    await admin.from("expenses").insert({
      org_id: user.orgId,
      project_id: project!.id,
      stage_id: stage!.id,
      category_id: material!.id,
      description: "Concreto",
      amount_cents: 1_500_000,
      spent_on: "2026-11-09",
      status: "confirmed",
      created_by: user.id,
    });

    await page.goto(projectUrl);
    const alerts = page.getByRole("region", { name: "Atenção" });
    await expect(alerts.getByText("Fundação")).toBeVisible();
    await expect(alerts.getByText("Perto do limite")).toBeVisible();
    await expect(
      alerts.getByText(
        "Já gastou 94% do previsto, mas a etapa está 0% pronta.",
      ),
    ).toBeVisible();

    // Progresso: Fundação 80% pronta tira o aviso de gasto à frente.
    await page.goto(`${projectUrl}/etapas/progresso`);
    await page
      .getByRole("combobox", { name: "Quanto Fundação está pronta" })
      .selectOption("80");
    await page.getByRole("button", { name: "Salvar progresso" }).click();
    await expect(page.getByText("Progresso salvo.")).toBeVisible();

    await page.goto(projectUrl);
    await expect(alerts.getByText("Perto do limite")).toBeVisible();
    await expect(alerts.getByText(/Já gastou/)).toHaveCount(0);
  });
});
