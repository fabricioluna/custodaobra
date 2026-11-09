import { House } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { projectsCopy } from "@/features/projects/copy";

const copy = projectsCopy.create;

export const metadata: Metadata = { title: copy.title };

// Provisório: o formulário de obra (com as etapas padrão) entra na Fase 1.
export default function NewProjectPage() {
  return (
    <>
      <PageHeader title={copy.title} description={copy.description} />
      <EmptyState
        icon={House}
        title={copy.comingSoonTitle}
        description={copy.comingSoonDescription}
      />
    </>
  );
}
