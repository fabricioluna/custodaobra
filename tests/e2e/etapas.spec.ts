import { expect, type Page, test } from "@playwright/test";

import { adminClient } from "../rls/helpers";
import { createE2EUser, deleteE2EUsers, type E2EUser, signIn } from "./helpers";

/**
 * Etapas escolhidas ao criar a obra (as sugeridas vêm marcadas) e etapa nova
 * criada na hora de lançar um gasto.
 */
test.describe("etapas", () => {
  const users: E2EUser[] = [];

  test.afterAll(async () => {
    await deleteE2EUsers(users);
  });

  async function newUser(page: Page, label: string) {
    const user = await createE2EUser(label);
    users.push(user);
    await adminClient()
      .from("profiles")
      .update({
        full_name: "Teste Etapas",
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    await signIn(page, user);
    await expect(page).toHaveURL(/\/o\/[a-z0-9-]+\/obras$/);
  }

  test("desmarca etapas ao criar e cria etapa nova ao lançar", async ({
    page,
  }) => {
    await newUser(page, "etapas");
    await page.getByRole("link", { name: "Nova obra" }).click();
    await page.getByLabel("Nome da obra").fill("Reforma");
    await expect(page.getByText("13 de 13 etapas marcadas.")).toBeVisible();
    await page.getByRole("checkbox", { name: "Fundação" }).uncheck();
    await page.getByRole("checkbox", { name: "Estrutura" }).uncheck();
    await expect(page.getByText("11 de 13 etapas marcadas.")).toBeVisible();
    await page.getByRole("button", { name: "Criar obra" }).click();
    await expect(page).toHaveURL(/\/obras\/[0-9a-f-]{36}$/);

    await page.getByRole("link", { name: "Etapas" }).click();
    await page.getByRole("link", { name: "Organizar etapas" }).click();
    await expect(
      page.getByLabel("Nome da etapa 3", { exact: true }),
    ).toHaveValue("Alvenaria");
    await expect(
      page.getByLabel("Nome da etapa 11", { exact: true }),
    ).toHaveValue("Limpeza e entrega");
    await expect(
      page.getByLabel("Nome da etapa 12", { exact: true }),
    ).toHaveCount(0);

    // "+ Nova etapa" no lançamento: cria a etapa e o gasto já entra nela.
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await nav.getByRole("link", { name: "Lançar gasto" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("50000");
    await page.getByLabel("Descrição").fill("Azulejo da piscina");
    await page
      .getByRole("combobox", { name: "Etapa", exact: true })
      .selectOption({ label: "+ Nova etapa" });
    await page.getByLabel("Nome da nova etapa").fill("Piscina");
    await page.getByRole("button", { name: /^Salvar gasto/ }).click();
    await expect(page.getByText("Gasto de R$ 500,00 lançado.")).toBeVisible();

    await page.getByRole("link", { name: "Gastos" }).first().click();
    await expect(
      page.getByRole("link", { name: /Azulejo da piscina/ }),
    ).toContainText("Piscina");
    await page.getByRole("link", { name: "Etapas" }).click();
    await page.getByRole("link", { name: "Organizar etapas" }).click();
    await expect(
      page.getByLabel("Nome da etapa 12", { exact: true }),
    ).toHaveValue("Piscina");
  });

  test("começa a obra sem etapas", async ({ page }) => {
    await newUser(page, "sem-etapas");
    await page.getByRole("link", { name: "Nova obra" }).click();
    await page.getByLabel("Nome da obra").fill("Do zero");
    await page.getByRole("button", { name: "Começar sem etapas" }).click();
    await expect(
      page.getByText("Nenhuma etapa: a obra começa vazia."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Criar obra" }).click();
    await expect(page).toHaveURL(/\/obras\/[0-9a-f-]{36}$/);

    const projectId = page.url().split("/").at(-1)!;
    const { count } = await adminClient()
      .from("stages")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    expect(count).toBe(0);
  });
});
