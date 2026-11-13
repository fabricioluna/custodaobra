import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { devices, expect, type Page, test } from "@playwright/test";

import { adminClient } from "../../tests/rls/helpers";
import {
  createE2EUser,
  deleteE2EUsers,
  type E2EUser,
  signIn,
} from "../../tests/e2e/helpers";

/**
 * Monta uma obra de demonstração (dados fictícios) numa conta de teste,
 * fotografa as telas no tamanho de celular e apaga tudo no fim.
 */
const OUT = path.join(process.cwd(), "docs", "guia", "capturas");
mkdirSync(OUT, { recursive: true });

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);
}

async function shot(page: Page, name: string, fullPage = true) {
  await settle(page);
  // Na foto da página inteira, a barra fixa de baixo cairia no meio.
  if (fullPage) {
    await page.addStyleTag({
      content: 'nav[aria-label="Navegação principal"]{display:none!important}',
    });
  }
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
}

test("capturas do guia", async ({ page, browser }) => {
  const admin = adminClient();
  const users: E2EUser[] = [];

  try {
    // ── Visitante: página inicial e entrada ─────────────────────────────
    const visitorContext = await browser.newContext({
      ...devices["Pixel 7"],
      baseURL: test.info().project.use.baseURL,
      locale: "pt-BR",
      timezoneId: "America/Recife",
    });
    const visitor = await visitorContext.newPage();
    // A primeira visita no `next dev` compila e recarrega a página.
    await visitor.goto("/");
    await settle(visitor);
    await visitor.goto("/");
    await shot(visitor, "01-inicio", false);
    await visitor
      .locator("section")
      .first()
      .screenshot({ path: path.join(OUT, "02-conversa.png") });
    for (const [heading, name] of [["Preços", "03-precos"]] as const) {
      const section = visitor
        .locator("section", {
          has: visitor.getByRole("heading", { name: heading, level: 2 }),
        })
        .first();
      if (await section.count()) {
        await section.screenshot({ path: path.join(OUT, `${name}.png`) });
      }
    }
    await visitor.screenshot({
      path: path.join(OUT, "00-inicio-completa.png"),
      fullPage: true,
    });
    await visitor.goto("/entrar");
    await shot(visitor, "04-entrar", false);
    await visitorContext.close();

    // ── Cadastro e primeiro acesso ──────────────────────────────────────
    const maria = await createE2EUser("guia");
    users.push(maria);
    await signIn(page, maria);
    await expect(page).toHaveURL(/\/primeiro-acesso$/);
    await page.getByLabel("Seu nome").fill("Maria Souza");
    await page.getByLabel("Nome da conta").fill("Maria Souza");
    await shot(page, "05-primeiro-acesso", false);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/obras\/nova$/);

    // ── Nova obra ───────────────────────────────────────────────────────
    await page.getByLabel("Nome da obra").fill("Casa da Maria");
    await page.getByLabel("Área construída (m²)").fill("120");
    const city = page.getByLabel("Cidade");
    if (await city.count()) await city.fill("Caruaru");
    await shot(page, "06-nova-obra");
    await page.getByRole("button", { name: "Criar obra" }).click();
    await expect(page).toHaveURL(/\/obras\/[0-9a-f-]{36}$/);
    const projectUrl = page.url();
    const projectId = projectUrl.split("/").pop()!;
    const orgBase = projectUrl.replace(/\/obras\/.*$/, "");
    await shot(page, "07-painel-vazio", false);

    // ── Dados de demonstração ───────────────────────────────────────────
    const orgId = maria.orgId;
    await admin
      .from("projects")
      .update({
        address: "Rua das Acácias, 120",
        state: "PE",
        city: "Caruaru",
        standard: "normal",
        status: "em_andamento",
        start_date: "2026-08-03",
        expected_end_date: "2027-06-30",
        cost_per_m2_cents: 280000,
      })
      .eq("id", projectId);

    const { data: stages } = await admin
      .from("stages")
      .select("id, name, default_percent")
      .eq("project_id", projectId);
    const stage = (name: string) => stages!.find((s) => s.name === name)!.id;
    const progress: Record<string, number> = {
      "Projetos e documentação": 100,
      "Serviços preliminares e terreno": 100,
      Fundação: 90,
      Estrutura: 30,
      Alvenaria: 10,
    };
    for (const s of stages!) {
      await admin
        .from("stages")
        .update({
          budget_cents: Math.round(
            (120 * 280000 * Number(s.default_percent ?? 0)) / 100,
          ),
          progress_percent: progress[s.name] ?? 0,
        })
        .eq("id", s.id);
    }

    const { data: categories } = await admin
      .from("categories")
      .select("id, code")
      .is("org_id", null);
    const cat = (code: string) => categories!.find((c) => c.code === code)!.id;

    const supplierIds: Record<string, string> = {};
    for (const [name, kind] of [
      ["Casa do Construtor", "loja"],
      ["Ferragens Nordeste", "loja"],
      ["Concreteira Agreste", "empresa"],
      ["Seu Antônio (pedreiro)", "profissional"],
      ["Vidraçaria Boa Vista", "empresa"],
    ] as const) {
      const { data } = await admin
        .from("suppliers")
        .insert({ org_id: orgId, name, kind })
        .select("id")
        .single();
      supplierIds[name] = data!.id;
    }

    type Row = {
      d: string;
      v: number;
      on: string;
      c: string;
      s?: string;
      f?: string;
      pay?: "pix" | "dinheiro" | "cartao_credito" | "boleto" | "transferencia";
      nf?: boolean;
      q?: [number, string, number];
      src?: "app" | "whatsapp_text" | "whatsapp_image" | "whatsapp_audio";
    };
    const rows: Row[] = [
      {
        d: "Compra do lote",
        v: 8500000,
        on: "2026-07-15",
        c: "terreno",
        pay: "transferencia",
      },
      {
        d: "ITBI e escritura do lote",
        v: 340000,
        on: "2026-07-28",
        c: "terreno",
        pay: "boleto",
      },
      {
        d: "Projeto arquitetônico",
        v: 450000,
        on: "2026-08-04",
        c: "servico_terceirizado",
        s: "Projetos e documentação",
        pay: "pix",
        nf: true,
      },
      {
        d: "Projeto estrutural e elétrico",
        v: 380000,
        on: "2026-08-12",
        c: "servico_terceirizado",
        s: "Projetos e documentação",
        pay: "pix",
        nf: true,
      },
      {
        d: "Alvará da prefeitura",
        v: 85000,
        on: "2026-08-20",
        c: "taxas_documentacao",
        s: "Projetos e documentação",
        pay: "boleto",
      },
      {
        d: "Limpeza do terreno",
        v: 120000,
        on: "2026-08-25",
        c: "mao_de_obra",
        s: "Serviços preliminares e terreno",
        pay: "pix",
      },
      {
        d: "Ligação provisória de água e luz",
        v: 60000,
        on: "2026-08-27",
        c: "taxas_documentacao",
        s: "Serviços preliminares e terreno",
        pay: "boleto",
      },
      {
        d: "Cimento CP-II",
        v: 156000,
        on: "2026-09-02",
        c: "material",
        s: "Fundação",
        f: "Casa do Construtor",
        pay: "cartao_credito",
        nf: true,
        q: [40, "saco", 3900],
        src: "whatsapp_image",
      },
      {
        d: "Areia lavada (2 carradas)",
        v: 90000,
        on: "2026-09-02",
        c: "material",
        s: "Fundação",
        f: "Casa do Construtor",
        pay: "pix",
        src: "whatsapp_text",
      },
      {
        d: "Brita 1",
        v: 78000,
        on: "2026-09-03",
        c: "material",
        s: "Fundação",
        f: "Casa do Construtor",
        pay: "pix",
      },
      {
        d: "Ferragem da fundação",
        v: 320000,
        on: "2026-09-05",
        c: "material",
        s: "Fundação",
        f: "Ferragens Nordeste",
        pay: "boleto",
        nf: true,
      },
      {
        d: "Aluguel de betoneira",
        v: 35000,
        on: "2026-09-08",
        c: "aluguel_equipamentos",
        s: "Fundação",
        pay: "dinheiro",
      },
      {
        d: "Empreita da fundação",
        v: 480000,
        on: "2026-09-30",
        c: "mao_de_obra",
        s: "Fundação",
        f: "Seu Antônio (pedreiro)",
        pay: "pix",
        src: "whatsapp_audio",
      },
      {
        d: "Concreto usinado",
        v: 680000,
        on: "2026-10-14",
        c: "material",
        s: "Estrutura",
        f: "Concreteira Agreste",
        pay: "boleto",
        nf: true,
      },
      {
        d: "Diária do servente (semana)",
        v: 60000,
        on: "2026-10-17",
        c: "mao_de_obra",
        s: "Estrutura",
        pay: "dinheiro",
        src: "whatsapp_text",
      },
      {
        d: "Tijolo 8 furos",
        v: 255000,
        on: "2026-11-03",
        c: "material",
        s: "Alvenaria",
        f: "Casa do Construtor",
        pay: "pix",
        nf: true,
        q: [3, "milheiro", 85000],
      },
      {
        d: "Pedreiro (semana)",
        v: 150000,
        on: "2026-11-07",
        c: "mao_de_obra",
        s: "Alvenaria",
        f: "Seu Antônio (pedreiro)",
        pay: "pix",
        src: "whatsapp_text",
      },
      {
        d: "Frete da loja",
        v: 12000,
        on: "2026-11-09",
        c: "frete",
        pay: "dinheiro",
        src: "whatsapp_text",
      },
      {
        d: "Lona preta",
        v: 8900,
        on: "2026-11-10",
        c: "material",
        f: "Casa do Construtor",
        pay: "pix",
      },
    ];
    const { data: inserted, error: insertError } = await admin
      .from("expenses")
      .insert(
        rows.map((r) => ({
          org_id: orgId,
          project_id: projectId,
          stage_id: r.s ? stage(r.s) : null,
          category_id: cat(r.c),
          supplier_id: r.f ? supplierIds[r.f] : null,
          description: r.d,
          amount_cents: r.v,
          spent_on: r.on,
          payment_method: r.pay ?? "pix",
          has_invoice: r.nf ?? false,
          quantity: r.q?.[0] ?? null,
          unit: r.q?.[1] ?? null,
          unit_price_cents: r.q?.[2] ?? null,
          status: "confirmed" as const,
          source: r.src ?? "app",
          created_by: maria.id,
        })),
      )
      .select("id, description");
    if (insertError) throw insertError;
    const cimentoId = inserted!.find(
      (e) => e.description === "Cimento CP-II",
    )!.id;

    const group = randomBytes(16).toString("hex");
    const groupId = `${group.slice(0, 8)}-${group.slice(8, 12)}-4${group.slice(13, 16)}-a${group.slice(17, 20)}-${group.slice(20, 32)}`;
    const { error: payError } = await admin.from("payables").insert([
      ...["2026-11-05", "2026-12-05", "2027-01-05"].map((due, i) => ({
        org_id: orgId,
        project_id: projectId,
        stage_id: stage("Esquadrias (portas e janelas)"),
        category_id: cat("material"),
        supplier_id: supplierIds["Vidraçaria Boa Vista"],
        description: "Janelas de alumínio",
        amount_cents: 240000,
        due_date: due,
        installment_group_id: groupId,
        installment_number: i + 1,
        installment_total: 3,
        created_by: maria.id,
      })),
      {
        org_id: orgId,
        project_id: projectId,
        stage_id: stage("Estrutura"),
        category_id: cat("material"),
        supplier_id: supplierIds["Concreteira Agreste"],
        description: "Concreto da laje",
        amount_cents: 290000,
        due_date: "2026-11-20",
        created_by: maria.id,
      },
    ]);
    if (payError) throw payError;

    await page.goto(`${orgBase}/configuracoes/plano`);
    await shot(page, "29-plano");

    // Equipe: João lança na obra; um convite em aberto para a cliente.
    // E-mail com cara de gente (aparece na tela da pessoa); apagado no fim.
    const { data: joaoAuth, error: joaoError } =
      await admin.auth.admin.createUser({
        email: "joao.batista@exemplo.com.br",
        email_confirm: true,
      });
    if (joaoError || !joaoAuth.user) throw joaoError;
    const { data: joaoProfile } = await admin
      .from("profiles")
      .select("default_org_id")
      .eq("id", joaoAuth.user.id)
      .single();
    const joao: E2EUser = {
      id: joaoAuth.user.id,
      email: "joao.batista@exemplo.com.br",
      orgId: joaoProfile!.default_org_id!,
    };
    users.push(joao);
    await admin
      .from("profiles")
      .update({
        full_name: "João Batista",
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", joao.id);
    await admin
      .from("organization_members")
      .insert({ org_id: orgId, user_id: joao.id, role: "member" });
    await admin.from("project_members").insert({
      org_id: orgId,
      project_id: projectId,
      user_id: joao.id,
      role: "editor",
    });
    await admin.from("invitations").insert({
      org_id: orgId,
      project_id: projectId,
      org_role: "member",
      project_role: "viewer",
      label: "Ana (cônjuge)",
      token_hash: createHash("sha256").update(randomBytes(32)).digest("hex"),
      invited_by: maria.id,
    });

    // ── Telas da obra ───────────────────────────────────────────────────
    await page.goto(projectUrl);
    await shot(page, "08-painel");

    await page.goto(`${projectUrl}/lancamentos/novo`);
    await page.getByLabel("Valor", { exact: true }).fill("30000");
    const desc = page.getByLabel("Descrição");
    if (await desc.count()) await desc.first().fill("Diária do eletricista");
    await shot(page, "09-lancar-gasto", false);
    const more = page.getByText("Mais detalhes");
    if (await more.count()) {
      await more.first().click();
      await shot(page, "10-mais-detalhes");
    }

    await page.goto(`${projectUrl}/lancamentos`);
    await shot(page, "11-gastos");
    await page.goto(`${projectUrl}/lancamentos/${cimentoId}`);
    await shot(page, "12-gasto-detalhe");

    await page.goto(`${projectUrl}/etapas`);
    await shot(page, "13-etapas");
    await page.goto(`${projectUrl}/etapas/orcamento`);
    await shot(page, "14-orcamento");
    await page.goto(`${projectUrl}/etapas/progresso`);
    await shot(page, "15-progresso");
    await page.goto(`${projectUrl}/etapas/organizar`);
    await shot(page, "16-organizar");

    await page.goto(`${projectUrl}/contas`);
    await shot(page, "17-contas");
    await page.goto(`${projectUrl}/contas/nova`);
    await page.getByLabel("Do que é a conta").fill("Telhas cerâmicas");
    await page.getByRole("combobox", { name: "Parcelas" }).selectOption("3");
    await page.getByLabel("Valor total").fill("450000");
    await shot(page, "18-nova-conta");
    await page.goto(`${projectUrl}/contas`);
    await page
      .getByRole("link", { name: /parcela 1\/3/ })
      .first()
      .click();
    await shot(page, "19-pagar-conta");

    await page.goto(`${projectUrl}/relatorio`);
    await shot(page, "20-relatorio");
    await page.goto(`${projectUrl}/configuracoes`);
    await shot(page, "21-config-obra");

    // ── Visão geral e configurações ─────────────────────────────────────
    await page.goto(`${orgBase}/obras`);
    await shot(page, "22-obras");
    await page.goto(`${orgBase}/configuracoes`);
    await shot(page, "23-configuracoes");
    await page.goto(`${orgBase}/configuracoes/equipe`);
    await shot(page, "24-equipe");
    await page.goto(`${orgBase}/configuracoes/equipe/convidar`);
    await shot(page, "25-convidar");
    await page.goto(`${orgBase}/configuracoes/equipe/${joao.id}`);
    await shot(page, "26-pessoa");
    await page.goto(`${orgBase}/configuracoes/whatsapp`);
    await shot(page, "27-whatsapp");
    const connect = page.getByRole("button", { name: /Conectar WhatsApp/ });
    if (await connect.count()) {
      await connect.first().click();
      await shot(page, "28-whatsapp-codigo");
    }
    await page.goto(`${orgBase}/configuracoes/meus-dados`);
    await shot(page, "30-meus-dados");
  } finally {
    await deleteE2EUsers(users);
  }
});
