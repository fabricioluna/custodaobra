import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { orgPath } from "@/components/layout/nav";
import { PageHeader } from "@/components/layout/page-header";
import { expensesCopy } from "@/features/expenses/copy";
import { requireOrg } from "@/features/organizations/queries";
import { ProjectPicker } from "@/features/projects/components/project-picker";
import { listProjects } from "@/features/projects/queries";

const copy = expensesCopy.list;

export const metadata: Metadata = { title: copy.title };

/** Gastos: com uma obra só, abre a lista dela; com várias, a pessoa escolhe. */
export default async function ExpensesPage({
  params,
}: PageProps<"/o/[orgSlug]/lancamentos">) {
  const { orgSlug } = await params;
  const org = await requireOrg(orgSlug);
  const projects = await listProjects(org.id);
  const listHref = (projectId: string) =>
    orgPath(org.slug, "obras", projectId, "lancamentos");

  if (projects.length === 1) redirect(listHref(projects[0].id));

  return (
    <>
      <PageHeader
        title={copy.title}
        description={projects.length > 1 ? copy.pickProject : copy.description}
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      ) : (
        <ProjectPicker projects={projects} hrefFor={listHref} />
      )}
    </>
  );
}
