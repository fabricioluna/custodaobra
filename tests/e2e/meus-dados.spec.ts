import { expect, test } from "@playwright/test";

import { adminClient } from "../rls/helpers";
import { createE2EUser, deleteE2EUsers, type E2EUser, signIn } from "./helpers";

/**
 * Fase 5, parte 2 (LGPD): a pessoa baixa a planilha com os dados dela e
 * exclui a conta, que some de verdade (login e organização).
 */
test.describe("seus dados", () => {
  const users: E2EUser[] = [];

  test.afterAll(async () => {
    await deleteE2EUsers(users);
  });

  test("baixa a planilha e exclui a conta", async ({ page }) => {
    test.setTimeout(90_000);
    const ana = await createE2EUser("dados-ana");
    users.push(ana);
    const admin = adminClient();
    await admin
      .from("profiles")
      .update({
        full_name: "Ana Dados",
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
    await page.getByRole("link", { name: /Seus dados/ }).click();
    await expect(
      page.getByText(/1 obra, gastos, contas e comprovantes/),
    ).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Baixar planilha" }).click();
    expect((await download).suggestedFilename()).toMatch(
      /^meus-dados-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );

    const confirm = page.getByLabel("Para confirmar, digite EXCLUIR");
    await confirm.fill("excluir");
    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    await expect(
      page.getByText(/Digite EXCLUIR, em letras maiúsculas/),
    ).toBeVisible();

    await confirm.fill("EXCLUIR");
    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    await expect(page).toHaveURL(/\/conta-excluida$/);
    await expect(
      page.getByRole("heading", { name: "Conta excluída" }),
    ).toBeVisible();

    const user = await admin.auth.admin.getUserById(ana.id);
    expect(user.data.user).toBeNull();
    const orgs = await admin
      .from("organizations")
      .select("id")
      .eq("id", ana.orgId);
    expect(orgs.data).toEqual([]);

    // Sem sessão: a área logada manda para o login.
    await page.goto(`/o/${org!.slug}/obras`);
    await expect(page).toHaveURL(/\/entrar/);
  });
});
