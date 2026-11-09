import {
  CalendarClock,
  House,
  type LucideIcon,
  Menu,
  ReceiptText,
} from "lucide-react";

import { layoutCopy } from "./copy";

export type NavKey = "projects" | "expenses" | "payables" | "more";

export type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  icon: LucideIcon;
};

/** Monta um caminho dentro da área da organização: /o/[orgSlug]/... */
export function orgPath(orgSlug: string, ...segments: string[]): string {
  return ["/o", encodeURIComponent(orgSlug), ...segments].join("/");
}

/**
 * Itens da navegação da organização. "Lançamentos" e "Contas" aqui mostram
 * todas as obras juntas; as telas por obra ficam em /obras/[projectId]/...
 */
export function getOrgNavItems(orgSlug: string): NavItem[] {
  const { nav } = layoutCopy;
  return [
    {
      key: "projects",
      label: nav.projects,
      href: orgPath(orgSlug, "obras"),
      icon: House,
    },
    {
      key: "expenses",
      label: nav.expenses,
      href: orgPath(orgSlug, "lancamentos"),
      icon: ReceiptText,
    },
    {
      key: "payables",
      label: nav.payables,
      href: orgPath(orgSlug, "contas"),
      icon: CalendarClock,
    },
    {
      key: "more",
      label: nav.more,
      href: orgPath(orgSlug, "configuracoes"),
      icon: Menu,
    },
  ];
}

/**
 * Destino da tecla "Lançar gasto". Dentro de uma obra, vai direto para o
 * formulário dela; fora, para a escolha da obra (ou direto, se só houver uma).
 */
export function getLaunchExpenseHref(
  orgSlug: string,
  projectId?: string,
): string {
  return projectId
    ? orgPath(orgSlug, "obras", projectId, "lancamentos", "novo")
    : orgPath(orgSlug, "lancamentos", "novo");
}

/** Onde a pessoa pode lançar gastos: todas as obras ou só algumas. */
export type LaunchAccess = { all: boolean; projectIds: string[] };

/**
 * Mostra a tecla "Lançar gasto"? Dentro de uma obra, só para quem edita a
 * obra; fora, para quem edita alguma. Quem só acompanha não vê a tecla.
 */
export function canLaunchExpense(
  access: LaunchAccess,
  projectId?: string,
): boolean {
  if (access.all) return true;
  return projectId
    ? access.projectIds.includes(projectId)
    : access.projectIds.length > 0;
}

/**
 * Item ativo para o caminho atual: o de href mais longo que seja igual ao
 * caminho ou um prefixo dele por segmento ("/obras" casa "/obras/123",
 * mas não "/obras-antigas").
 */
export function getActiveNavKey(
  pathname: string,
  items: readonly NavItem[],
): NavKey | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  let best: NavItem | null = null;
  for (const item of items) {
    const matches = path === item.href || path.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.href.length)) {
      best = item;
    }
  }
  return best?.key ?? null;
}
