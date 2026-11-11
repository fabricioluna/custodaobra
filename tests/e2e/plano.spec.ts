import { expect, test } from "@playwright/test";

import { adminClient } from "../rls/helpers";
import { createE2EUser, deleteE2EUsers, type E2EUser, signIn } from "./helpers";

/** Fase 5, parte 3: o dono vê o plano e o uso do mês nas configurações. */
test.describe("plano e uso", () => {
  const users: E2EUser[] = [];

  test.afterAll(async () => {
    await deleteE2EUsers(users);
  });

  test("o dono vê o plano e os contadores", async ({ page }) => {
    const ana = await createE2EUser("plano-ana");
    users.push(ana);
    const admin = adminClient();
    await admin
      .from("profiles")
      .update({
        full_name: "Ana Plano",
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", ana.id);
    await admin
      .from("projects")
      .insert({ org_id: ana.orgId, name: "Casa da Ana", created_by: ana.id });
    const { data: org } = await admin
      .from("organizations")
      .select("slug")
      .eq("id", ana.orgId)
      .single();

    await signIn(page, ana, `/o/${org!.slug}/configuracoes`);
    await page.getByRole("link", { name: /Plano e uso/ }).click();
    await expect(page.getByRole("heading", { name: "Pessoal" })).toBeVisible();
    await expect(
      page.getByRole("meter", { name: "Obras ativas" }),
    ).toHaveAttribute("aria-valuenow", "1");
    await expect(page.getByText("Limite atingido")).toBeVisible();
    if (process.env.SHOT_DIR) {
      await page.screenshot({
        path: `${process.env.SHOT_DIR}/plano.png`,
        fullPage: true,
      });
      await page.goto(`/o/${org!.slug}/configuracoes/meus-dados`);
      await page.getByRole("button", { name: "Excluir minha conta" }).waitFor();
      await page.screenshot({
        path: `${process.env.SHOT_DIR}/meus-dados.png`,
        fullPage: true,
      });
    }
  });
});
