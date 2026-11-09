import { expect, test } from "@playwright/test";

import { adminClient } from "../rls/helpers";
import { createE2EUser, deleteE2EUsers, type E2EUser, signIn } from "./helpers";

/**
 * Fase 2, parte 2: conta parcelada, "marcar como paga" virando gasto e o
 * "a pagar" da etapa no previsto x realizado.
 */
test.describe("contas a pagar", () => {
  const users: E2EUser[] = [];

  test.afterAll(async () => {
    await deleteE2EUsers(users);
  });

  test("parcela, paga e o pagamento vira gasto", async ({ page }) => {
    const user = await createE2EUser("contas");
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
        name: "Casa com Contas",
        created_by: user.id,
      })
      .select("id")
      .single();
    await admin
      .from("stages")
      .update({ budget_cents: 1_000_000 })
      .eq("project_id", project!.id)
      .eq("name", "Cobertura");

    await signIn(page, user);
    await expect(
      page.getByRole("heading", { level: 1, name: "Casa com Contas" }),
    ).toBeVisible();
    const projectUrl = page.url();

    // Nova conta: R$ 1.500,00 em 3 parcelas na Cobertura.
    await page
      .getByRole("link", { name: "Contas", exact: true })
      .first()
      .click();
    await expect(page.getByText("Nenhuma conta a pagar")).toBeVisible();
    await page.getByRole("link", { name: "Nova conta" }).click();
    await page.getByLabel("Do que é a conta").fill("Boleto da madeira");
    await page.getByRole("combobox", { name: "Parcelas" }).selectOption("3");
    await page.getByLabel("Valor total").fill("150000");
    await expect(page.getByText("3× de R$ 500,00")).toBeVisible();
    await page
      .getByRole("combobox", { name: "Etapa" })
      .selectOption({ label: "Cobertura" });
    await page.getByRole("button", { name: "Salvar conta" }).click();

    await expect(page.getByText("3 parcelas salvas.")).toBeVisible();
    const totals = page.getByRole("region", { name: "Total a pagar" });
    await expect(totals.getByText("R$ 1.500,00")).toBeVisible();
    await expect(page.getByText("parcela 1/3 · Cobertura")).toBeVisible();

    // O "a pagar" aparece no previsto x realizado da etapa.
    await page.goto(`${projectUrl}/etapas`);
    await expect(page.getByText("+ R$ 1.500,00 a pagar")).toBeVisible();

    // Pagar a primeira com juros: R$ 520,00.
    await page.goto(`${projectUrl}/contas`);
    await page.getByRole("link", { name: /parcela 1\/3/ }).click();
    await expect(page.getByText("vence hoje")).toBeVisible();
    await page.getByLabel("Valor pago").fill("52000");
    await page
      .getByRole("combobox", { name: "Forma de pagamento" })
      .selectOption("boleto");
    await page.getByRole("button", { name: /Confirmar pagamento/ }).click();

    await expect(
      page.getByText("Pagamento de R$ 520,00 lançado nos gastos."),
    ).toBeVisible();
    await expect(totals.getByText("R$ 1.000,00")).toBeVisible();
    await expect(page.getByRole("region", { name: "Pagas" })).toContainText(
      "R$ 520,00",
    );

    // O pagamento está na lista de gastos, e a etapa mostra gasto + a pagar.
    await page.goto(`${projectUrl}/lancamentos`);
    await expect(
      page.getByText("Boleto da madeira (parcela 1/3)"),
    ).toBeVisible();
    await page.goto(`${projectUrl}/etapas`);
    await expect(page.getByText("+ R$ 1.000,00 a pagar")).toBeVisible();
    await expect(page.getByText("R$ 520,00 de R$ 10.000,00")).toBeVisible();
  });
});
