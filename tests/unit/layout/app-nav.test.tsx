import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppNav } from "@/components/layout/app-nav";

const navigation = vi.hoisted(() => ({
  pathname: "/o/minha-casa/lancamentos",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useParams: () => ({ orgSlug: "minha-casa" }),
}));

describe("AppNav", () => {
  beforeEach(() => {
    navigation.pathname = "/o/minha-casa/lancamentos";
  });

  it("mostra os itens e o botão Lançar gasto na barra inferior", () => {
    render(<AppNav />);
    const [, bottomNav] = screen.getAllByRole("navigation", {
      name: "Navegação principal",
    });
    const links = within(bottomNav).getAllByRole("link");

    expect(links.map((l) => l.textContent)).toEqual([
      "Obras",
      "Lançamentos",
      "Lançar gasto",
      "Contas",
      "Mais",
    ]);
    expect(
      within(bottomNav).getByRole("link", { name: "Lançar gasto" }),
    ).toHaveAttribute("href", "/o/minha-casa/lancamentos/novo");
  });

  it("marca só o item da página atual com aria-current", () => {
    navigation.pathname = "/o/minha-casa/contas";
    render(<AppNav />);

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");

    // Um na barra lateral e um na barra inferior.
    expect(current).toHaveLength(2);
    for (const link of current) {
      expect(link).toHaveTextContent("Contas");
    }
  });
});
