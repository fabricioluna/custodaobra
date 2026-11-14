import { expect, test } from "@playwright/test";

import { adminClient } from "../rls/helpers";
import { deleteE2EUsers, type E2EUser } from "./helpers";

/**
 * Entrar com e-mail e senha, criar conta (código uma vez só) e "Esqueci
 * minha senha". Os e-mails reais vão para endereços de teste do Resend
 * (delivered+...@resend.dev), que só aceitam e descartam; o código é gerado
 * pelo admin, como o e-mail traria.
 */
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const testEmail = (label: string) =>
  `delivered+e2e-${label}-${runId}@resend.dev`;

const users: E2EUser[] = [];

/** Guarda a conta criada para apagar no fim (com a organização pessoal). */
async function track(email: string) {
  const admin = adminClient();
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const id = list.users.find((user) => user.email === email)?.id;
  if (!id) return;
  const { data } = await admin
    .from("profiles")
    .select("default_org_id")
    .eq("id", id)
    .maybeSingle();
  if (data?.default_org_id)
    users.push({ id, email, orgId: data.default_org_id });
}

test.afterAll(async () => {
  await deleteE2EUsers(users);
});

test("entra com e-mail e senha; senha errada explica o que fazer", async ({
  page,
}) => {
  const email = testEmail("login");
  const password = "Obra-Teste-2026";
  const { error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  await track(email);

  await page.goto("/entrar");
  await page.getByLabel("Seu e-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-errada");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText(/E-mail ou senha errados/)).toBeVisible();

  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  // Conta nova: primeiro acesso.
  await expect(page).toHaveURL(/\/primeiro-acesso$/);
});

test("cria conta com senha e confirma o e-mail com o código uma vez", async ({
  page,
}) => {
  const email = testEmail("cadastro");
  const password = "Casa-Nova-2026";

  await page.goto("/entrar");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Seu e-mail").fill(email);
  await page.getByLabel("Crie uma senha").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Confirme seu e-mail" }),
  ).toBeVisible();
  await track(email);

  // O mesmo código que o e-mail de confirmação traria.
  const { data, error } = await adminClient().auth.admin.generateLink({
    type: "signup",
    email,
    password,
  });
  if (error) throw error;
  await page.getByLabel("Código do e-mail").fill(data.properties.email_otp);
  await page.getByRole("button", { name: "Confirmar e entrar" }).click();
  await expect(page).toHaveURL(/\/primeiro-acesso$/);

  // Cadastrar de novo o mesmo e-mail avisa que a conta existe.
  await page.context().clearCookies();
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Seu e-mail").fill(email);
  await page.getByLabel("Crie uma senha").fill("Outra-Senha-2026");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(
    page.getByText(/Já existe uma conta com este e-mail/),
  ).toBeVisible();
});

test("esqueci minha senha: código e senha nova na mesma tela", async ({
  page,
}) => {
  // Conta que sempre entrou por código (sem senha).
  const email = testEmail("esqueci");
  const { error } = await adminClient().auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) throw error;
  await track(email);

  await page.goto("/entrar");
  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await page.getByLabel("Seu e-mail").fill(email);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(
    page.getByRole("heading", { name: "Confira seu e-mail" }),
  ).toBeVisible();

  const { data, error: linkError } =
    await adminClient().auth.admin.generateLink({ type: "recovery", email });
  if (linkError) throw linkError;
  const newPassword = "Senha-Nova-2026";
  await page.getByLabel("Código do e-mail").fill(data.properties.email_otp);
  await page.getByLabel("Senha nova").fill(newPassword);
  await page.getByRole("button", { name: "Salvar senha e entrar" }).click();
  await expect(page).toHaveURL(/\/primeiro-acesso$/);

  // Da próxima vez, entra com a senha.
  await page.context().clearCookies();
  await page.goto("/entrar");
  await page.getByLabel("Seu e-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/primeiro-acesso$/);
});
