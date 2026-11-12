import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";

import { marketingCopy } from "../copy";
import type { LegalDocument } from "../legal";
import { SiteFooter } from "./site-footer";

/** Página de texto legal (termos, privacidade): leitura confortável no celular. */
export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <>
      <header className="bg-brand-navy px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-10 text-brand-white sm:px-10">
        <div className="mx-auto max-w-3xl">
          <Link href="/" aria-label={marketingCopy.legal.back}>
            <BrandMark iconSize={32} />
          </Link>
          <h1 className="mt-10 text-3xl heading sm:text-4xl">
            {document.title}
          </h1>
          <p className="mt-2 text-brand-white/70">
            {marketingCopy.legal.updatedAt(document.updatedAt)}
          </p>
        </div>
      </header>
      <main className="flex-1 bg-background px-4 py-10 sm:px-10">
        <article className="mx-auto flex max-w-3xl flex-col gap-8 text-base leading-relaxed">
          <p className="text-lg">{document.intro}</p>
          {document.sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-3">
              <h2 className="text-xl font-bold">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-graphite dark:text-brand-white/80"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
          <Link
            href="/"
            className="inline-flex min-h-11 items-center self-start font-semibold underline underline-offset-4"
          >
            {marketingCopy.legal.back}
          </Link>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
