import type { Metadata } from "next";
import Link from "next/link";

import { AuthScreen } from "@/components/layout/auth-screen";
import { buttonVariants } from "@/components/ui/button";
import { accountCopy } from "@/features/account/copy";
import { cn } from "@/lib/utils";

const copy = accountCopy.deleted;

export const metadata: Metadata = { title: copy.title };

export default function AccountDeletedPage() {
  return (
    <AuthScreen title={copy.title} description={copy.description}>
      <Link
        href="/"
        className={cn(
          buttonVariants({ variant: "action", size: "lg" }),
          "w-full",
        )}
      >
        {copy.home}
      </Link>
    </AuthScreen>
  );
}
