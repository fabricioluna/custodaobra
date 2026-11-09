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

export function getLaunchExpenseHref(orgSlug: string): string {
  return orgPath(orgSlug, "lancamentos", "novo");
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
