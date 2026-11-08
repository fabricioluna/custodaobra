"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { BrandMark } from "./brand-mark";
import { layoutCopy } from "./copy";
import {
  getActiveNavKey,
  getLaunchExpenseHref,
  getOrgNavItems,
  type NavItem,
  type NavKey,
} from "./nav";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar";

/**
 * Navegação da área logada: barra inferior no celular e barra lateral no
 * computador. Lê a URL, então precisa estar dentro de <Suspense> (cacheComponents).
 */
export function AppNav() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const pathname = usePathname();

  const items = getOrgNavItems(orgSlug);
  const activeKey = getActiveNavKey(pathname, items);
  const launchHref = getLaunchExpenseHref(orgSlug);

  return (
    <>
      <SideNav items={items} activeKey={activeKey} launchHref={launchHref} />
      <BottomNav items={items} activeKey={activeKey} launchHref={launchHref} />
    </>
  );
}

type NavViewProps = {
  items: NavItem[];
  activeKey: NavKey | null;
  launchHref: string;
};

function BottomNav({ items, activeKey, launchHref }: NavViewProps) {
  const [first, second, ...rest] = items;
  return (
    <nav
      aria-label={layoutCopy.nav.label}
      className="fixed inset-x-0 bottom-0 z-40 bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground md:hidden"
    >
      <ul className="grid h-16 grid-cols-[1fr_1fr_5.5rem_1fr_1fr]">
        {[first, second].map((item) => (
          <BottomNavItem
            key={item.key}
            item={item}
            active={item.key === activeKey}
          />
        ))}
        <li className="flex justify-center">
          <LaunchKey href={launchHref} />
        </li>
        {rest.map((item) => (
          <BottomNavItem
            key={item.key}
            item={item}
            active={item.key === activeKey}
          />
        ))}
      </ul>
    </nav>
  );
}

/**
 * A tecla dourada de lançar gasto: a ação mais importante do app, a maior
 * área de toque da tela, sempre no centro e ao alcance do polegar.
 */
function LaunchKey({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group -mt-5 flex flex-col items-center gap-1.5 rounded-2xl",
        focusRing,
      )}
    >
      <span className="flex size-15 items-center justify-center rounded-[1.1rem] bg-action text-action-foreground shadow-[0_4px_0_0_rgb(0_0_0/0.28)] transition-transform group-active:translate-y-1 group-active:shadow-none motion-reduce:transition-none">
        <Plus className="size-8" strokeWidth={2.75} aria-hidden />
      </span>
      <span className="text-xs leading-none font-bold whitespace-nowrap">
        {layoutCopy.nav.launchExpense}
      </span>
    </Link>
  );
}

function BottomNavItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-full flex-col items-center justify-center gap-1 text-xs leading-none",
          active
            ? "font-bold text-sidebar-primary before:absolute before:inset-x-4 before:top-0 before:h-[3px] before:rounded-b-full before:bg-sidebar-primary"
            : "font-medium text-sidebar-foreground/75 hover:text-sidebar-foreground",
          focusRing,
        )}
      >
        <Icon
          className="size-6"
          strokeWidth={active ? 2.25 : 1.75}
          aria-hidden
        />
        {item.label}
      </Link>
    </li>
  );
}

function SideNav({ items, activeKey, launchHref }: NavViewProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-8 bg-sidebar px-4 py-6 text-sidebar-foreground md:flex">
      <div className="px-2">
        <BrandMark />
      </div>
      <Link
        href={launchHref}
        className={cn(
          "flex h-13 items-center justify-center gap-2 rounded-xl bg-action text-base font-bold text-action-foreground shadow-[0_3px_0_0_rgb(0_0_0/0.28)] transition-transform active:translate-y-0.5 active:shadow-none motion-reduce:transition-none",
          focusRing,
        )}
      >
        <Plus className="size-5" strokeWidth={2.75} aria-hidden />
        {layoutCopy.nav.launchExpense}
      </Link>
      <nav aria-label={layoutCopy.nav.label}>
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.key === activeKey;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 items-center gap-3 rounded-lg px-3 text-base",
                    active
                      ? "bg-sidebar-accent font-bold text-sidebar-primary before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary"
                      : "font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    focusRing,
                  )}
                >
                  <Icon
                    className="size-5"
                    strokeWidth={active ? 2.25 : 1.75}
                    aria-hidden
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

/** Ocupa o mesmo espaço da navegação enquanto a URL não é lida (sem pulo de layout). */
export function AppNavFallback() {
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-sidebar px-6 py-6 md:block"
      >
        <BrandMark />
      </div>
      <div
        aria-hidden
        className="fixed inset-x-0 bottom-0 z-40 h-16 bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
      />
    </>
  );
}
