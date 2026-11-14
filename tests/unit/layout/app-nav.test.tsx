import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppNav } from "@/components/layout/app-nav";

const navigation = vi.hoisted(() => ({
  pathname: "/o/minha-casa/lancamentos",
  projectId: undefined as string | undefined,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useParams: () => ({
    orgSlug: "minha-casa",
    projectId: navigation.projectId,
  }),
}));

// A ação do servidor importa `server-only`; no teste só o botão importa.
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));

const owner = { all: true, projectIds: [] };

describe("AppNav", () => {
  beforeEach(() => {
    navigation.pathname = "/o/minha-casa/lancamentos";
    navigation.projectId = undefined;
  });

  it("mostra os itens e o botão Lançar gasto na barra inferior", () => {
    render(<AppNav access={owner} />);
    const [, bottomNav] = screen.getAllByRole("navigation", {
      name: "Navegação principal",
    });
    const links = within(bottomNav).getAllByRole("link");

    expect(links.map((l) => l.textContent)).toEqual([
      "Obras",
      "Gastos",
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
    render(<AppNav access={owner} />);

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");

    // Um na barra lateral e um na barra inferior.
    expect(current).toHaveLength(2);
    for (const link of current) {
      expect(link).toHaveTextContent("Contas");
    }
  });

  it("esconde Lançar gasto de quem só acompanha a obra", () => {
    navigation.pathname = "/o/minha-casa/obras/obra-1";
    navigation.projectId = "obra-1";
    render(<AppNav access={{ all: false, projectIds: ["obra-2"] }} />);

    expect(screen.queryByRole("link", { name: "Lançar gasto" })).toBeNull();
    // Os outros itens continuam lá.
    expect(screen.getAllByRole("link", { name: "Obras" })).toHaveLength(2);
  });

  it("mostra Lançar gasto na obra em que a pessoa é editora", () => {
    navigation.pathname = "/o/minha-casa/obras/obra-2";
    navigation.projectId = "obra-2";
    render(<AppNav access={{ all: false, projectIds: ["obra-2"] }} />);

    expect(
      screen.getAllByRole("link", { name: "Lançar gasto" })[0],
    ).toHaveAttribute("href", "/o/minha-casa/obras/obra-2/lancamentos/novo");
  });
});
