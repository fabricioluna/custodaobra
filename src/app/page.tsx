import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { orgPath } from "@/components/layout/nav";
import { buttonVariants } from "@/components/ui/button";
import { APP_TAGLINE } from "@/config/app";
import { marketingCopy } from "@/features/marketing/copy";

// Provisório até a landing page (Fase 5). O link leva a uma organização de
// demonstração só para ver o layout; o login substitui isso na Fase 0.
const DEMO_ORG_SLUG = "demo";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-brand-navy px-4 py-16 text-center">
      <BrandMark className="text-4xl sm:text-5xl" iconSize={56} />
      <p className="max-w-md text-lg text-brand-white/85">{APP_TAGLINE}</p>
      <Link
        href={orgPath(DEMO_ORG_SLUG, "obras")}
        className={buttonVariants({ variant: "action", size: "lg" })}
      >
        {marketingCopy.home.demoLink}
      </Link>
    </main>
  );
}
