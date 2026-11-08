import { House } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { projectsCopy } from "@/features/projects/copy";

const copy = projectsCopy.list;

export const metadata: Metadata = { title: copy.title };

export default function ProjectsPage() {
  return (
    <>
      <PageHeader title={copy.title} description={copy.description} />
      <EmptyState
        icon={House}
        title={copy.emptyTitle}
        description={copy.emptyDescription}
      />
    </>
  );
}
