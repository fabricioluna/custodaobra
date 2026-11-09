import { expect, test } from "@playwright/test";

import { adminClient } from "../rls/helpers";
import { createE2EUser, deleteE2EUsers, type E2EUser, signIn } from "./helpers";

/**
 * Fase 2, parte 3 (critério de aceite): a dona convida alguém só para uma
 * obra, como "Só acompanha"; a pessoa aceita pelo link, vê só aquela obra e
 * não encontra como lançar ou editar nada.
 */
test.describe("equipe e convites", () => {
  const users: E2EUser[] = [];

  test.afterAll(async () => {
    await deleteE2EUsers(users);
  });

  test("convidada viewer vê só a obra do convite e não edita", async ({
    page,
    browser,
  }) => {
    // Duas contas e muitas telas: mais tempo que o padrão.
    test.setTimeout(120_000);
    const ana = await createE2EUser("equipe-ana");
    const carla = await createE2EUser("equipe-carla");
    users.push(ana, carla);

    const admin = adminClient();
    await admin
      .from("profiles")
      .update({
        full_name: "Ana Souza",
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", ana.id);
    await admin.from("projects").insert([
      { org_id: ana.orgId, name: "Casa da Ana", created_by: ana.id },
      { org_id: ana.orgId, name: "Galpão", created_by: ana.id },
    ]);

    // A dona gera o convite pela tela da equipe.
    await signIn(page, ana);
    await expect(
      page.getByRole("heading", { level: 1, name: "Obras" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Mais" }).last().click();
    await page.getByRole("link", { name: /Equipe/ }).click();
    await page.getByRole("link", { name: "Convidar pessoa" }).click();
    await page.getByRole("radio", { name: /Só uma obra/ }).check();
    await page
      .getByRole("combobox", { name: "Obra" })
      .selectOption({ label: "Casa da Ana" });
    await page.getByRole("radio", { name: /Só acompanha/ }).check();
    await page.getByLabel(/Nome para lembrar/).fill("Carla");
    await page.getByRole("button", { name: "Gerar link de convite" }).click();

    const linkInput = page.getByRole("textbox", { name: "Link pronto" });
    await expect(linkInput).toBeVisible();
    const link = await linkInput.inputValue();
    const invitePath = new URL(link).pathname;
    expect(invitePath).toMatch(/^\/convite\/[A-Za-z0-9_-]{43}$/);

    await page.getByRole("link", { name: "Voltar para a equipe" }).click();
    await expect(page.getByText("Casa da Ana (só acompanha)")).toBeVisible();

    // A convidada (conta nova) abre o link, entra e aceita.
    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await guest.goto(invitePath);
    await expect(
      guest.getByRole("heading", { name: "Ana convidou você" }),
    ).toBeVisible();
    await expect(
      guest.getByText("Para a obra Casa da Ana: só acompanha."),
    ).toBeVisible();

    await signIn(guest, carla, invitePath);
    await guest.getByLabel("Seu nome").fill("Carla Lima");
    await guest.getByRole("button", { name: "Aceitar convite" }).click();

    // Aceitar redireciona para a obra (no dev, a 1ª visita ainda compila).
    await expect(
      guest.getByRole("heading", { level: 1, name: "Casa da Ana" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(guest.getByRole("link", { name: "Lançar gasto" })).toHaveCount(
      0,
    );

    // Só a obra do convite aparece na lista.
    await guest.getByRole("link", { name: "Obras" }).first().click();
    await expect(
      guest.getByRole("heading", { level: 1, name: "Obras" }),
    ).toBeVisible();
    await expect(
      guest.getByRole("link", { name: /^Casa da Ana/ }),
    ).toBeVisible();
    await expect(guest.getByRole("link", { name: /Galpão/ })).toHaveCount(0);
    await expect(guest.getByRole("link", { name: "Nova obra" })).toHaveCount(0);

    // Nada de editar: etapas sem atalhos e a equipe não existe para ela.
    await guest.getByRole("link", { name: /^Casa da Ana/ }).click();
    await guest.getByRole("link", { name: "Etapas" }).click();
    await expect(guest.getByRole("link", { name: /Orçamento/ })).toHaveCount(0);
    const orgUrl = new URL(guest.url()).pathname.split("/obras")[0];
    await guest.goto(`${orgUrl}/configuracoes/equipe`);
    await expect(
      guest.getByRole("heading", { name: "Página não encontrada" }),
    ).toBeVisible();

    // O link já usado não serve para mais ninguém.
    await page.goto(invitePath);
    await expect(
      page.getByText("Este convite já foi usado por outra pessoa."),
    ).toBeVisible();

    await guestContext.close();
  });
});
