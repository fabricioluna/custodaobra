import { expect, test } from "@playwright/test";

import { createE2EUser, deleteE2EUsers, type E2EUser, signIn } from "./helpers";

test.describe("entrada no app", () => {
  test("página inicial leva ao login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/entrar$/);
    await expect(
      page.getByRole("button", { name: "Entrar com Google" }),
    ).toBeVisible();
    await expect(page.getByLabel("Seu e-mail")).toBeVisible();
  });

  test("área logada sem sessão manda para o login e guarda o destino", async ({
    page,
  }) => {
    await page.goto("/o/qualquer-conta/obras");
    await expect(page).toHaveURL(
      /\/entrar\?next=%2Fo%2Fqualquer-conta%2Fobras$/,
    );
  });
});

/**
 * Critério de aceite da Fase 0: um usuário novo se cadastra e cai na tela de
 * criar obra.
 */
test.describe("cadastro", () => {
  const users: E2EUser[] = [];

  test.afterAll(async () => {
    await deleteE2EUsers(users);
  });

  test("usuário novo passa pelo primeiro acesso e cai em criar obra", async ({
    page,
  }) => {
    const user = await createE2EUser("cadastro");
    users.push(user);

    await signIn(page, user);
    await expect(page).toHaveURL(/\/primeiro-acesso$/);

    await page.getByLabel("Seu nome").fill("Maria Teste");
    // O nome da conta acompanha o nome da pessoa enquanto ela não mexe nele.
    await expect(page.getByLabel("Nome da conta")).toHaveValue("Maria Teste");
    await page.getByLabel("Nome da conta").fill("Casa da Maria");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page).toHaveURL(/\/o\/[a-z0-9-]+\/obras\/nova$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("conta de outra pessoa aparece como página não encontrada", async ({
    page,
  }) => {
    const user = await createE2EUser("intrusa");
    users.push(user);
    await signIn(page, user, "/o/conta-que-nao-e-minha/obras");
    await expect(
      page.getByRole("heading", { name: "Página não encontrada" }),
    ).toBeVisible();
  });
});
