import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { orgPath } from "@/components/layout/nav";
import { buttonVariants } from "@/components/ui/button";
import { APP_TAGLINE } from "@/config/app";
import { marketingCopy } from "@/features/marketing/copy";
import { cn } from "@/lib/utils";

// Provisório até a landing page (Fase 5). O link leva a uma organização de
// demonstração só para ver o layout; o login substitui isso na Fase 0.
const DEMO_ORG_SLUG = "demo";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col bg-brand-navy blueprint-grid px-4 py-8 text-brand-white sm:px-10">
      <BrandMark iconSize={40} className="text-xl" />
      <div className="flex max-w-3xl flex-1 flex-col justify-center gap-10 py-16">
        <h1 className="text-[2.5rem] heading sm:text-6xl lg:text-7xl">
          {APP_TAGLINE}
        </h1>
        <Link
          href={orgPath(DEMO_ORG_SLUG, "obras")}
          className={cn(
            buttonVariants({ variant: "action", size: "lg" }),
            "h-14 self-start px-8 text-lg",
          )}
        >
          {marketingCopy.home.demoLink}
        </Link>
      </div>
    </main>
  );
}
