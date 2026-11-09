import type { ReactNode } from "react";

import { BrandMark } from "./brand-mark";

/**
 * Moldura das telas de entrada (login, primeiro acesso): azul planta com a
 * grade no alto e uma folha clara que sobe de baixo, perto do polegar.
 * No computador, a folha vira um painel centralizado.
 */
export function AuthScreen({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-brand-navy blueprint-grid md:items-center md:justify-center md:px-6 md:py-12">
      <div className="w-full md:max-w-md">
        <header className="px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-10 text-brand-white md:px-0 md:pt-0 md:pb-8">
          <BrandMark iconSize={36} />
          <h1 className="mt-10 text-[2rem] heading md:mt-12 md:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-prose text-base text-brand-white/80">
              {description}
            </p>
          ) : null}
        </header>
        <section className="rounded-t-3xl bg-background px-5 pt-7 pb-[calc(2rem+env(safe-area-inset-bottom))] md:rounded-3xl md:p-8">
          {children}
        </section>
      </div>
      {/* No celular, a folha clara continua até o fim da tela. */}
      <div aria-hidden className="flex-1 bg-background md:hidden" />
    </main>
  );
}
