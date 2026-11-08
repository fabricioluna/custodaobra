"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground md:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {[first, second].map((item) => (
          <BottomNavItem
            key={item.key}
            item={item}
            active={item.key === activeKey}
          />
        ))}
        <li className="flex justify-center">
          <Link
            href={launchHref}
            className={cn(
              "-mt-5 flex flex-col items-center gap-1 rounded-2xl",
              focusRing,
            )}
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-action text-action-foreground shadow-lg ring-4 ring-sidebar">
              <Plus className="size-7" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="text-[11px] leading-none font-semibold">
              {layoutCopy.nav.launchExpense}
            </span>
          </Link>
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

function BottomNavItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-full flex-col items-center justify-center gap-1 text-[11px] leading-none font-medium",
          active
            ? "font-semibold text-sidebar-primary"
            : "text-sidebar-foreground/75 hover:text-sidebar-foreground",
          focusRing,
        )}
      >
        <Icon className="size-6" aria-hidden />
        {item.label}
      </Link>
    </li>
  );
}

function SideNav({ items, activeKey, launchHref }: NavViewProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-6 bg-sidebar px-4 py-5 text-sidebar-foreground md:flex">
      <div className="px-2">
        <BrandMark />
      </div>
      <Link
        href={launchHref}
        className={cn(
          buttonVariants({ variant: "action", size: "lg" }),
          "w-full",
          focusRing,
        )}
      >
        <Plus aria-hidden />
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
                    "flex h-11 items-center gap-3 rounded-lg px-3 text-base",
                    active
                      ? "bg-sidebar-accent font-semibold text-sidebar-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    focusRing,
                  )}
                >
                  <Icon className="size-5" aria-hidden />
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
        className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-sidebar px-6 py-5 md:block"
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
