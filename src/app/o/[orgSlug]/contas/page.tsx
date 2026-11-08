import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { payablesCopy } from "@/features/payables/copy";

const copy = payablesCopy.list;

export const metadata: Metadata = { title: copy.title };

export default function PayablesPage() {
  return (
    <>
      <PageHeader title={copy.title} description={copy.description} />
      <EmptyState
        icon={CalendarClock}
        title={copy.emptyTitle}
        description={copy.emptyDescription}
      />
    </>
  );
}
