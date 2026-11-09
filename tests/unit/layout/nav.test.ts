import { describe, expect, it } from "vitest";

import {
  getActiveNavKey,
  getLaunchExpenseHref,
  getOrgNavItems,
  orgPath,
} from "@/components/layout/nav";

describe("orgPath", () => {
  it("monta caminhos dentro da organização", () => {
    expect(orgPath("minha-casa", "obras")).toBe("/o/minha-casa/obras");
    expect(orgPath("minha-casa")).toBe("/o/minha-casa");
  });

  it("escapa caracteres especiais do slug", () => {
    expect(orgPath("a b", "obras")).toBe("/o/a%20b/obras");
  });
});

describe("getOrgNavItems", () => {
  it("lista Obras, Gastos, Contas e Mais, nessa ordem", () => {
    const items = getOrgNavItems("minha-casa");
    expect(items.map((i) => i.label)).toEqual([
      "Obras",
      "Gastos",
      "Contas",
      "Mais",
    ]);
    expect(items.map((i) => i.href)).toEqual([
      "/o/minha-casa/obras",
      "/o/minha-casa/lancamentos",
      "/o/minha-casa/contas",
      "/o/minha-casa/configuracoes",
    ]);
  });

  it("aponta Lançar gasto para o formulário de novo lançamento", () => {
    expect(getLaunchExpenseHref("minha-casa")).toBe(
      "/o/minha-casa/lancamentos/novo",
    );
  });

  it("dentro de uma obra, Lançar gasto vai direto para a obra", () => {
    expect(getLaunchExpenseHref("minha-casa", "abc")).toBe(
      "/o/minha-casa/obras/abc/lancamentos/novo",
    );
  });
});

describe("getActiveNavKey", () => {
  const items = getOrgNavItems("minha-casa");

  it.each([
    ["/o/minha-casa/obras", "projects"],
    ["/o/minha-casa/obras/", "projects"],
    ["/o/minha-casa/obras/123/etapas", "projects"],
    ["/o/minha-casa/lancamentos", "expenses"],
    ["/o/minha-casa/lancamentos/novo", "expenses"],
    ["/o/minha-casa/contas", "payables"],
    ["/o/minha-casa/configuracoes/whatsapp", "more"],
  ])("%s ativa %s", (pathname, key) => {
    expect(getActiveNavKey(pathname, items)).toBe(key);
  });

  it("não confunde segmentos com o mesmo começo", () => {
    expect(getActiveNavKey("/o/minha-casa/obras-antigas", items)).toBeNull();
  });

  it("não ativa nada fora da organização", () => {
    expect(getActiveNavKey("/", items)).toBeNull();
    expect(getActiveNavKey("/o/outra/obras", items)).toBeNull();
  });
});
