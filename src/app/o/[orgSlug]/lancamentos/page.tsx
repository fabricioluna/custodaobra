import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { expensesCopy } from "@/features/expenses/copy";

const copy = expensesCopy.list;

export const metadata: Metadata = { title: copy.title };

export default function ExpensesPage() {
  return (
    <>
      <PageHeader title={copy.title} description={copy.description} />
      <EmptyState
        icon={ReceiptText}
        title={copy.emptyTitle}
        description={copy.emptyDescription}
      />
    </>
  );
}
