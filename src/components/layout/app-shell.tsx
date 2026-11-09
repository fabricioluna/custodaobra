import { Suspense, type ReactNode } from "react";

import { AppNavFallback } from "./app-nav";
import { BrandMark } from "./brand-mark";
import { layoutCopy } from "./copy";

const MAIN_ID = "conteudo";

/**
 * Moldura da área logada, mobile first: cabeçalho azul-marinho e barra de
 * navegação inferior no celular; barra lateral fixa a partir de md.
 * `nav` é a navegação (lê a URL e o acesso da pessoa), que entra dentro de
 * <Suspense> para o resto da moldura continuar pré-renderizado.
 */
export function AppShell({
  children,
  nav,
}: {
  children: ReactNode;
  nav: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href={`#${MAIN_ID}`}
        className="sr-only z-50 rounded-md bg-action px-4 py-3 font-semibold text-action-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {layoutCopy.skipToContent}
      </a>

      <header className="sticky top-0 z-30 flex h-14 items-center bg-sidebar px-4 pt-[env(safe-area-inset-top)] text-sidebar-foreground md:hidden print:hidden">
        <BrandMark />
      </header>

      {/* Na impressão (relatório em PDF) só o conteúdo vai para o papel. */}
      <div className="contents print:hidden">
        <Suspense fallback={<AppNavFallback />}>{nav}</Suspense>
      </div>

      <div className="flex flex-1 flex-col md:pl-64 print:pl-0">
        <main
          id={MAIN_ID}
          className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pt-8 md:pb-10 print:max-w-none print:p-0"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
