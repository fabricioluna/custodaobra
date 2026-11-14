import { expect, test } from "@playwright/test";

import { adminClient } from "../rls/helpers";
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

  test("página inicial mostra preços e leva aos termos e à privacidade", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Preços", level: 2 }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Termos de Uso" }).click();
    await expect(page).toHaveURL(/\/termos$/);
    await expect(
      page.getByRole("heading", { name: "Termos de Uso", level: 1 }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Política de Privacidade" }).click();
    await expect(page).toHaveURL(/\/privacidade$/);
    await expect(page.getByText("Anthropic").first()).toBeVisible();
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

  test("Configurações mostra com qual e-mail entrou e sai da conta", async ({
    page,
  }) => {
    const user = await createE2EUser("sair");
    users.push(user);
    await adminClient()
      .from("profiles")
      .update({
        full_name: "Saída Teste",
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    await signIn(page, user);
    await expect(page).toHaveURL(/\/o\/[a-z0-9-]+\/obras$/);
    const settings = page.url().replace(/\/obras$/, "/configuracoes");

    await page.goto(settings);
    await expect(
      page.getByText(`Você entrou como ${user.email}`),
    ).toBeVisible();
    await page
      .getByRole("main")
      .getByRole("button", { name: "Sair da conta" })
      .click();
    await expect(page).toHaveURL(/\/entrar$/);

    // Sem sessão, a área logada volta para o login.
    await page.goto(settings);
    await expect(page).toHaveURL(/\/entrar\?next=/);
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
