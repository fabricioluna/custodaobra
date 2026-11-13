import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { test } from "@playwright/test";

import { adminClient } from "../../tests/rls/helpers";
import {
  createE2EUser,
  deleteE2EUsers,
  type E2EUser,
  signIn,
} from "../../tests/e2e/helpers";

/**
 * Mede o tempo de cada tela com uma obra de demonstração (dados fictícios),
 * contra o build de produção e o Supabase do .env.local. Apaga tudo no fim.
 *   npm run build && npx playwright test --config scripts/perf/playwright.config.ts
 * Resultado em scripts/perf/out/resultado.json (fora do Git).
 */
const OUT = path.join(process.cwd(), "scripts", "perf", "out");
const RUNS = Number(process.env.PERF_RUNS ?? 3);

test("tempo das telas", async ({ page }) => {
  const admin = adminClient();
  const users: E2EUser[] = [];
  try {
    const user = await createE2EUser("perf");
    users.push(user);
    await admin
      .from("profiles")
      .update({
        full_name: "Teste Velocidade",
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    const { data: orgRow } = await admin
      .from("organizations")
      .select("slug")
      .eq("id", user.orgId)
      .single();
    const { data: project } = await admin
      .from("projects")
      .insert({
        org_id: user.orgId,
        name: "Casa Velocidade",
        built_area_m2: 120,
        cost_per_m2_cents: 280000,
        created_by: user.id,
      })
      .select("id")
      .single();
    const projectId = project!.id;
    const { data: stages } = await admin
      .from("stages")
      .select("id, default_percent")
      .eq("project_id", projectId);
    await Promise.all(
      stages!.map((s) =>
        admin
          .from("stages")
          .update({
            budget_cents: Math.round(
              (120 * 280000 * Number(s.default_percent ?? 0)) / 100,
            ),
          })
          .eq("id", s.id),
      ),
    );
    const { data: categories } = await admin
      .from("categories")
      .select("id, code")
      .is("org_id", null);
    const { data: supplier } = await admin
      .from("suppliers")
      .insert({ org_id: user.orgId, name: "Casa do Construtor", kind: "loja" })
      .select("id")
      .single();
    // 120 gastos espalhados por 6 meses, etapas e categorias.
    const { data: expenses } = await admin
      .from("expenses")
      .insert(
        Array.from({ length: 120 }, (_, i) => ({
          org_id: user.orgId,
          project_id: projectId,
          stage_id: i % 9 === 0 ? null : stages![i % stages!.length].id,
          category_id: categories![i % categories!.length].id,
          supplier_id: i % 3 === 0 ? supplier!.id : null,
          description: `Gasto de teste ${i + 1}`,
          amount_cents: 5000 + ((i * 7919) % 300000),
          spent_on: `2026-${String(5 + (i % 6)).padStart(2, "0")}-${String(1 + (i % 27)).padStart(2, "0")}`,
          status: "confirmed" as const,
          created_by: user.id,
        })),
      )
      .select("id");
    await admin.from("payables").insert(
      Array.from({ length: 6 }, (_, i) => ({
        org_id: user.orgId,
        project_id: projectId,
        category_id: categories![0].id,
        description: `Conta de teste ${i + 1}`,
        amount_cents: 100000,
        due_date: `2026-${String(10 + Math.floor(i / 2)).padStart(2, "0")}-15`,
        created_by: user.id,
      })),
    );

    const org = `/o/${orgSlug(orgRow?.slug)}`;
    const obra = `${org}/obras/${projectId}`;
    const pages: [string, string][] = [
      ["obras", `${org}/obras`],
      ["painel", obra],
      ["gastos", `${obra}/lancamentos`],
      ["gastos-filtro", `${obra}/lancamentos?q=teste`],
      ["novo-gasto", `${obra}/lancamentos/novo`],
      ["gasto", `${obra}/lancamentos/${expenses![5].id}`],
      ["etapas", `${obra}/etapas`],
      ["orcamento", `${obra}/etapas/orcamento`],
      ["contas", `${obra}/contas`],
      ["obra-config", `${obra}/configuracoes`],
      ["relatorio", `${obra}/relatorio`],
      ["todas-contas", `${org}/contas`],
      ["todos-gastos", `${org}/lancamentos`],
      ["config", `${org}/configuracoes`],
      ["equipe", `${org}/configuracoes/equipe`],
      ["plano", `${org}/configuracoes/plano`],
      ["whatsapp", `${org}/configuracoes/whatsapp`],
    ];

    await signIn(page, user);
    await page.waitForURL(/\/o\//);
    // Aquece: a primeira visita de cada rota carrega o código no servidor.
    for (const [, url] of pages) await page.goto(url);

    const results: Record<string, number[]> = {};
    const markers: { name: string; start: number; end: number }[] = [];
    for (let run = 0; run < RUNS; run++) {
      for (const [name, url] of pages) {
        const start = Date.now();
        await page.goto(url, { waitUntil: "load" });
        const end = Date.now();
        (results[name] ??= []).push(end - start);
        markers.push({ name, start, end });
      }
    }

    // Navegação pelas abas da obra (como a pessoa usa): do toque até a tela
    // responder (esqueleto ou conteúdo novo) e até o conteúdo final.
    const ready: Record<string, RegExp> = {
      Gastos: /^\d+ gastos?$/,
      Etapas: /^Organizar etapas$/,
      Contas: /^Nova conta$/,
      Obra: /^Dados da obra$/,
      Painel: /^Gasto na construção$/,
    };
    const tabs: Record<string, number[]> = {};
    const firstPaint: Record<string, number[]> = {};
    await page.goto(obra);
    for (let run = 0; run < RUNS; run++) {
      for (const tab of Object.keys(ready)) {
        // Medido dentro do navegador, a cada quadro: quando aparece o
        // esqueleto ou o conteúdo, e quando o conteúdo final fica visível. O
        // Next guarda as telas visitadas escondidas na página: só conta o que
        // está visível.
        await page.evaluate((source) => {
          const pattern = new RegExp(source);
          const w = window as unknown as { __nav: Record<string, number> };
          const t0 = performance.now();
          w.__nav = {};
          const visible = (el: Element) =>
            el.checkVisibility({
              checkOpacity: true,
              checkVisibilityCSS: true,
            });
          const tick = () => {
            const busy = [
              ...document.querySelectorAll('[aria-busy="true"]'),
            ].some(visible);
            const done = [
              ...document.querySelectorAll("p, h2, span, a, h1"),
            ].some(
              (el) => pattern.test(el.textContent?.trim() ?? "") && visible(el),
            );
            if ((busy || done) && w.__nav.first === undefined)
              w.__nav.first = performance.now() - t0;
            if (done && !busy && w.__nav.ready === undefined)
              w.__nav.ready = performance.now() - t0;
            if (w.__nav.ready === undefined) requestAnimationFrame(tick);
          };
          // Só começa a olhar depois do clique.
          setTimeout(() => requestAnimationFrame(tick), 0);
        }, ready[tab].source);
        await page
          .getByRole("navigation", { name: "Casa Velocidade" })
          .getByRole("link", { name: tab, exact: true })
          .click();
        const nav = await page.waitForFunction(
          () =>
            (window as unknown as { __nav: Record<string, number> }).__nav
              .ready !== undefined &&
            (window as unknown as { __nav: Record<string, number> }).__nav,
        );
        const { first, ready: done } = (await nav.jsonValue()) as Record<
          string,
          number
        >;
        (firstPaint[tab] ??= []).push(Math.round(first));
        (tabs[tab] ??= []).push(Math.round(done));
      }
    }

    // Lançar um gasto pelo app: do toque em "Salvar gasto" até o painel
    // mostrar o aviso de lançado (a ação grava e o painel é montado de novo).
    const launch: number[] = [];
    for (let run = 0; run < RUNS; run++) {
      await page.goto(`${obra}/lancamentos/novo`);
      await page.getByLabel("Valor", { exact: true }).fill("12345");
      const start = Date.now();
      await page.getByRole("button", { name: /Salvar gasto/ }).click();
      await page
        .getByText(/^Gasto (de R\$\s?123,45 )?lançado\.$/)
        .filter({ visible: true })
        .first()
        .waitFor({ timeout: 20_000 })
        .catch(async (error) => {
          await page.screenshot({ path: path.join(OUT, "lancar-erro.png") });
          console.log("url depois de salvar:", page.url());
          throw error;
        });
      launch.push(Date.now() - start);
    }

    const median = (xs: number[]) =>
      [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const summary = Object.fromEntries(
      Object.entries(results).map(([k, v]) => [k, median(v)]),
    );
    const tabSummary = Object.fromEntries(
      Object.entries(tabs).map(([k, v]) => [k, median(v)]),
    );
    const paintSummary = Object.fromEntries(
      Object.entries(firstPaint).map(([k, v]) => [k, median(v)]),
    );
    mkdirSync(OUT, { recursive: true });
    writeFileSync(
      path.join(OUT, `resultado-${process.env.PERF_LABEL ?? "atual"}.json`),
      JSON.stringify(
        {
          pages: summary,
          tabs: tabSummary,
          firstPaint: paintSummary,
          launch: median(launch),
          markers,
        },
        null,
        2,
      ),
    );
    console.log("páginas (mediana ms):", summary);
    console.log("abas, resposta ao toque (mediana ms):", paintSummary);
    console.log("abas, conteúdo pronto (mediana ms):", tabSummary);
    console.log("lançar gasto até o aviso (mediana ms):", median(launch));
  } finally {
    await deleteE2EUsers(users);
  }
});

function orgSlug(slug: string | undefined) {
  if (!slug) throw new Error("conta sem slug");
  return slug;
}
