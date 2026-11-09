import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { APP_TAGLINE } from "@/config/app";
import { marketingCopy } from "@/features/marketing/copy";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { cn } from "@/lib/utils";

// Provisório até a landing page (Fase 5).
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col bg-brand-navy blueprint-grid px-4 py-8 text-brand-white sm:px-10">
      <BrandMark iconSize={40} className="text-xl" />
      <div className="flex max-w-3xl flex-1 flex-col justify-center gap-10 py-16">
        <h1 className="text-[2.5rem] heading sm:text-6xl lg:text-7xl">
          {APP_TAGLINE}
        </h1>
        <Link
          href={LOGIN_PATH}
          className={cn(
            buttonVariants({ variant: "action", size: "lg" }),
            "h-14 self-start px-8 text-lg",
          )}
        >
          {marketingCopy.home.login}
        </Link>
      </div>
    </main>
  );
}
