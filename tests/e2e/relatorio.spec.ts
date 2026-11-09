import { expect, test } from "@playwright/test";

import { adminClient } from "../rls/helpers";
import { createE2EUser, deleteE2EUsers, type E2EUser, signIn } from "./helpers";

/**
 * Fase 2, parte 4: relatório da obra para "Salvar como PDF", com resumo,
 * previsto x realizado, contas em aberto e, se pedir, a lista de gastos.
 */
test.describe("relatório da obra", () => {
  const users: E2EUser[] = [];

  test.afterAll(async () => {
    await deleteE2EUsers(users);
  });

  test("mostra o resumo, as etapas e a lista de gastos", async ({ page }) => {
    const user = await createE2EUser("relatorio");
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
        name: "Casa Relatada",
        built_area_m2: 100,
        city: "Recife",
        state: "PE",
        created_by: user.id,
      })
      .select("id")
      .single();

    const { data: stage } = await admin
      .from("stages")
      .update({ budget_cents: 2_000_000 })
      .eq("project_id", project!.id)
      .eq("name", "Fundação")
      .select("id")
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
      description: "Concreto usinado",
      amount_cents: 1_500_000,
      spent_on: "2026-11-09",
      status: "confirmed",
      created_by: user.id,
    });
    await admin.from("payables").insert({
      org_id: user.orgId,
      project_id: project!.id,
      stage_id: stage!.id,
      category_id: material!.id,
      description: "Ferragem",
      amount_cents: 300_000,
      due_date: "2099-01-10",
      created_by: user.id,
    });

    await signIn(page, user);
    await expect(
      page.getByRole("heading", { level: 1, name: "Casa Relatada" }),
    ).toBeVisible();
    const reportLink = page.getByRole("link", { name: "Relatório em PDF" });
    await expect(reportLink).toHaveAttribute("href", /\/relatorio$/);
    await page.goto(`${page.url()}/relatorio`);

    await expect(page.getByText("Casa Relatada").last()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Salvar em PDF" }),
    ).toBeVisible();

    const summary = page.getByRole("region", { name: "Resumo" });
    await expect(summary.getByText("R$ 15.000,00")).toBeVisible();
    // R$ 15.000,00 em 100 m².
    await expect(summary.getByText("R$ 150,00")).toBeVisible();
    await expect(summary.getByText("R$ 3.000,00")).toBeVisible();

    const stages = page.getByRole("region", {
      name: "Previsto x realizado por etapa",
    });
    const fundacao = stages.getByRole("row", { name: /Fundação/ });
    await expect(fundacao.getByText("R$ 20.000,00")).toBeVisible();
    // (15.000 + 3.000) / 20.000 = 90%: perto do limite.
    await expect(fundacao.getByText("90%")).toBeVisible();
    await expect(fundacao.getByText("Perto do limite")).toBeVisible();
    await expect(
      page.getByText("Sobra do previsto: R$ 2.000,00"),
    ).toBeVisible();

    await expect(
      page.getByRole("region", { name: "Contas a pagar em aberto" }),
    ).toContainText("Ferragem");
    await expect(
      page.getByRole("region", { name: "Gastos lançados" }),
    ).toHaveCount(0);

    await page.getByRole("link", { name: "Incluir a lista de gastos" }).click();
    await expect(
      page
        .getByRole("region", { name: "Gastos lançados" })
        .getByText("Concreto usinado"),
    ).toBeVisible();

    // No papel, só o relatório: sem navegação nem abas da obra.
    await page.emulateMedia({ media: "print" });
    await expect(
      page.getByRole("button", { name: "Salvar em PDF" }),
    ).toBeHidden();
    await expect(
      page.getByRole("heading", { level: 1, name: "Casa Relatada" }),
    ).toBeHidden();
    await expect(page.getByRole("region", { name: "Resumo" })).toBeVisible();
  });
});
