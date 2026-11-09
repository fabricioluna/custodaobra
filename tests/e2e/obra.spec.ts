import { expect, test } from "@playwright/test";

import { adminClient } from "../rls/helpers";
import { createE2EUser, deleteE2EUsers, type E2EUser, signIn } from "./helpers";

/**
 * Critério de aceite da Fase 1: lançar um gasto pelo celular em até 3 toques
 * além de digitar o valor; o painel atualiza na hora.
 */
test.describe("obra e gastos", () => {
  const users: E2EUser[] = [];

  test.afterAll(async () => {
    await deleteE2EUsers(users);
  });

  test("cria a obra, lança, classifica, exporta e exclui um gasto", async ({
    page,
  }) => {
    const user = await createE2EUser("obra");
    users.push(user);
    // Pula o primeiro acesso (coberto em cadastro.spec.ts).
    await adminClient()
      .from("profiles")
      .update({
        full_name: "Pedro Teste",
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    await signIn(page, user);
    await expect(page).toHaveURL(/\/o\/[a-z0-9-]+\/obras$/);

    // Cadastro da obra.
    await page.getByRole("link", { name: "Nova obra" }).click();
    await page.getByLabel("Nome da obra").fill("Casa Teste");
    await page.getByLabel("Área construída (m²)").fill("100");
    await page.getByRole("button", { name: "Criar obra" }).click();
    await expect(page).toHaveURL(/\/obras\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Casa Teste" }),
    ).toBeVisible();
    const projectUrl = page.url();

    // Etapas padrão criadas junto com a obra.
    await page.getByRole("link", { name: "Etapas" }).click();
    await expect(
      page.getByLabel("Nome da etapa 1", { exact: true }),
    ).toHaveValue("Projetos e documentação");
    await expect(
      page.getByLabel("Nome da etapa 13", { exact: true }),
    ).toHaveValue("Limpeza e entrega");

    // Lançar gasto: toque 1 (tecla dourada), digita o valor e a descrição,
    // toque 2 (salvar).
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await nav.getByRole("link", { name: "Lançar gasto" }).click();
    await expect(page).toHaveURL(/\/lancamentos\/novo$/);
    await page.getByLabel("Valor", { exact: true }).fill("30000");
    await expect(page.getByLabel("Valor", { exact: true })).toHaveValue(
      "R$ 300,00",
    );
    await page.getByLabel("Descrição").fill("pedreiro");
    await page.getByRole("button", { name: /^Salvar gasto/ }).click();

    // O painel já mostra o gasto.
    await expect(page.getByText("Gasto de R$ 300,00 lançado.")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Gasto na construção" }),
    ).toContainText("R$ 300,00");
    await expect(
      page.getByRole("region", { name: "Gasto na construção" }),
    ).toContainText("R$ 3,00 por m² construído");
    // Sem etapa: aparece em "Para classificar".
    await expect(
      page.getByRole("heading", { name: "Para classificar" }),
    ).toBeVisible();

    // "pedreiro" vira Mão de obra sozinho.
    await page.getByRole("link", { name: "Gastos" }).first().click();
    await expect(page).toHaveURL(/\/lancamentos$/);
    const row = page.getByRole("link", { name: /pedreiro/ });
    await expect(row).toContainText("Mão de obra");
    await expect(row).toContainText("Sem etapa");

    // Classificar: escolhe a etapa.
    await row.click();
    await page.getByLabel("Etapa").selectOption({ label: "Alvenaria" });
    await page.getByRole("button", { name: /^Salvar alterações/ }).click();
    await expect(page).toHaveURL(/\/lancamentos$/);
    await expect(page.getByRole("link", { name: /pedreiro/ })).toContainText(
      "Alvenaria",
    );

    // Planilha.
    const csv = await page.request.get(`${projectUrl}/lancamentos/exportar`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const text = await csv.text();
    expect(text).toContain("pedreiro;300,00;Mão de obra;Alvenaria");

    // Excluir.
    await page.getByRole("link", { name: /pedreiro/ }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Excluir gasto" }).click();
    await expect(page).toHaveURL(/\/lancamentos$/);
    await expect(page.getByText("Nenhum gasto ainda")).toBeVisible();
  });

  test("plano pessoal não deixa criar a segunda obra", async ({ page }) => {
    const user = await createE2EUser("limite");
    users.push(user);
    const admin = adminClient();
    await admin
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", user.id);
    await admin
      .from("projects")
      .insert({ org_id: user.orgId, name: "Primeira", created_by: user.id });

    // Com uma obra só, o app abre direto no painel dela.
    await signIn(page, user);
    await expect(
      page.getByRole("heading", { level: 1, name: "Primeira" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: "Obras", exact: true })
      .first()
      .click();
    await page.getByRole("link", { name: "Nova obra" }).click();
    await expect(
      page.getByText(/Seu plano permite 1 obra ativa/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar obra" })).toHaveCount(
      0,
    );
  });
});
