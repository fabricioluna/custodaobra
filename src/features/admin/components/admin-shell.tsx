import type { ReactNode } from "react";

import { BrandMark } from "@/components/layout/brand-mark";

/** Moldura das páginas do painel interno (fora da área de uma conta). */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="bg-brand-navy px-4 py-4 text-brand-white sm:px-8">
        <BrandMark />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
