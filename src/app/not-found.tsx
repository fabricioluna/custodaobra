import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { marketingCopy } from "@/features/marketing/copy";
import { AFTER_LOGIN_PATH } from "@/lib/auth/paths";
import { cn } from "@/lib/utils";

const copy = marketingCopy.notFound;

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-brand-navy blueprint-grid px-4 py-8 text-brand-white sm:px-10">
      <BrandMark iconSize={36} />
      <div className="flex max-w-xl flex-1 flex-col justify-center gap-6 py-16">
        <h1 className="text-4xl heading sm:text-5xl">{copy.title}</h1>
        <p className="text-lg text-brand-white/80">{copy.description}</p>
        <Link
          href={AFTER_LOGIN_PATH}
          className={cn(
            buttonVariants({ variant: "action", size: "lg" }),
            "self-start",
          )}
        >
          {copy.back}
        </Link>
      </div>
    </main>
  );
}
