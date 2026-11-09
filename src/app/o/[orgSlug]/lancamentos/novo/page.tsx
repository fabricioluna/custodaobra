import { House } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { orgPath } from "@/components/layout/nav";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { expensesCopy } from "@/features/expenses/copy";
import { requireOrg } from "@/features/organizations/queries";
import { ProjectPicker } from "@/features/projects/components/project-picker";
import { listProjects } from "@/features/projects/queries";
import { cn } from "@/lib/utils";

const copy = expensesCopy.create;

export const metadata: Metadata = { title: copy.title };

/**
 * "Lançar gasto" fora de uma obra: com uma obra só, vai direto para o
 * formulário dela; com várias, a pessoa escolhe; sem nenhuma, cadastra.
 */
export default async function NewExpensePage({
  params,
}: PageProps<"/o/[orgSlug]/lancamentos/novo">) {
  const { orgSlug } = await params;
  const org = await requireOrg(orgSlug);
  const projects = await listProjects(org.id);
  const newExpenseHref = (projectId: string) =>
    orgPath(org.slug, "obras", projectId, "lancamentos", "novo");

  if (projects.length === 1) redirect(newExpenseHref(projects[0].id));

  if (projects.length === 0) {
    return (
      <>
        <PageHeader title={copy.title} />
        <EmptyState
          icon={House}
          title={copy.noProjectTitle}
          description={copy.noProjectDescription}
          action={
            <Link
              href={orgPath(org.slug, "obras", "nova")}
              className={cn(buttonVariants({ size: "lg" }), "rounded-xl")}
            >
              {copy.noProjectAction}
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={copy.pickProjectTitle}
        description={copy.pickProjectDescription}
      />
      <ProjectPicker projects={projects} hrefFor={newExpenseHref} />
    </>
  );
}
