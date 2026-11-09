"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type ProjectTab = { href: string; label: string; exact?: boolean };

/** Abas da obra. Lê a URL para marcar a ativa. */
export function ProjectTabs({
  tabs,
  label,
}: {
  tabs: ProjectTab[];
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="-mx-4 mb-6 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      <ul className="flex min-w-max gap-1 border-b">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  active
                    ? "font-bold text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-t-full after:bg-primary"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
