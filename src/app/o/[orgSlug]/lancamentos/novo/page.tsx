import { Plus } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { expensesCopy } from "@/features/expenses/copy";

const copy = expensesCopy.create;

export const metadata: Metadata = { title: copy.title };

// Provisório: o formulário curto de lançamento entra na Fase 1.
export default function NewExpensePage() {
  return (
    <>
      <PageHeader title={copy.title} />
      <EmptyState
        icon={Plus}
        title={copy.comingSoonTitle}
        description={copy.comingSoonDescription}
      />
    </>
  );
}
