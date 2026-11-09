import type { Metadata } from "next";

import { BrandMark } from "@/components/layout/brand-mark";
import { marketingCopy } from "@/features/marketing/copy";

const copy = marketingCopy.offline;

export const metadata: Metadata = { title: copy.title };

/** Mostrada pelo service worker quando o celular está sem conexão. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-brand-navy blueprint-grid px-4 py-8 text-brand-white sm:px-10">
      <BrandMark iconSize={36} />
      <div className="flex max-w-xl flex-1 flex-col justify-center gap-6 py-16">
        <h1 className="text-4xl heading sm:text-5xl">{copy.title}</h1>
        <p className="text-lg text-brand-white/80">{copy.description}</p>
      </div>
    </main>
  );
}
