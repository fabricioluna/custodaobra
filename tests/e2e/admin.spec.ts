import { expect, test } from "@playwright/test";

import { adminClient } from "../rls/helpers";
import { createE2EUser, deleteE2EUsers, type E2EUser, signIn } from "./helpers";

/** Fase 5, parte 5: só a equipe abre o painel interno. */
test.describe("painel interno", () => {
  const users: E2EUser[] = [];

  test.afterAll(async () => {
    await deleteE2EUsers(users);
  });

  test("a equipe vê as contas; o cliente recebe página não encontrada", async ({
    page,
  }) => {
    const equipe = await createE2EUser("admin-equipe");
    const cliente = await createE2EUser("admin-cliente");
    users.push(equipe, cliente);
    const admin = adminClient();
    await admin.from("platform_admins").insert({ user_id: equipe.id });

    await signIn(page, cliente, "/admin");
    await expect(
      page.getByRole("heading", { name: "Página não encontrada" }),
    ).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, equipe, "/admin");
    await expect(
      page.getByRole("heading", { name: "Painel interno" }),
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: cliente.email })).toBeVisible();
    if (process.env.SHOT_DIR) {
      await page.screenshot({
        path: `${process.env.SHOT_DIR}/admin.png`,
        fullPage: true,
      });
    }
  });
});
