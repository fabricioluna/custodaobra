import { LogOut, Settings } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";
import { authCopy } from "@/features/auth/copy";
import { settingsCopy as copy } from "@/features/settings/copy";

export const metadata: Metadata = { title: copy.title };

// Provisório: organização, membros, plano e WhatsApp entram nas próximas fases.
export default function SettingsPage() {
  return (
    <>
      <PageHeader title={copy.title} description={copy.description} />
      <EmptyState
        icon={Settings}
        title={copy.comingSoonTitle}
        description={copy.comingSoonDescription}
      />
      <form action={signOut} className="mt-10 border-t pt-6">
        <Button type="submit" variant="outline" size="lg">
          <LogOut aria-hidden />
          {authCopy.signOut}
        </Button>
      </form>
    </>
  );
}
