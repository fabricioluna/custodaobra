import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/layout/brand-mark";
import { APP_CONTACT_EMAIL } from "@/config/app";

import { marketingCopy } from "../copy";

const copy = marketingCopy.footer;

/** Rodapé das páginas públicas (início, termos, privacidade). */
export function SiteFooter() {
  return (
    <footer className="bg-brand-navy px-4 py-10 text-brand-white sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <BrandMark iconSize={32} />
        <nav className="flex flex-col gap-1 sm:flex-row sm:gap-6">
          <FooterLink href="/termos">{copy.terms}</FooterLink>
          <FooterLink href="/privacidade">{copy.privacy}</FooterLink>
          <FooterLink href={`mailto:${APP_CONTACT_EMAIL}`}>
            {copy.contact}
          </FooterLink>
        </nav>
      </div>
      <p className="mx-auto mt-6 max-w-6xl text-sm text-brand-white/60">
        {copy.rights}
      </p>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center text-brand-white/85 underline-offset-4 hover:text-brand-white hover:underline"
    >
      {children}
    </Link>
  );
}
