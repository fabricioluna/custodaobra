import { Archive, House, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { orgPath } from "@/components/layout/nav";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireOrg } from "@/features/organizations/queries";
import { ProjectCard } from "@/features/projects/components/project-card";
import { projectsCopy } from "@/features/projects/copy";
import {
  canManageOrg,
  countArchivedProjects,
  listProjects,
} from "@/features/projects/queries";
import { cn } from "@/lib/utils";

const copy = projectsCopy.list;

export const metadata: Metadata = { title: copy.title };

export default async function ProjectsPage({
  params,
}: PageProps<"/o/[orgSlug]/obras">) {
  const { orgSlug } = await params;
  const org = await requireOrg(orgSlug);
  const [projects, canManage, archivedCount] = await Promise.all([
    listProjects(org.id),
    canManageOrg(org.id),
    countArchivedProjects(org.id),
  ]);

  const newProjectLink = canManage ? (
    <Link
      href={orgPath(org.slug, "obras", "nova")}
      className={cn(buttonVariants({ size: "lg" }), "rounded-xl")}
    >
      <Plus aria-hidden />
      {copy.create}
    </Link>
  ) : null;

  const archivedLink =
    archivedCount > 0 ? (
      <Link
        href={orgPath(org.slug, "obras", "arquivadas")}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <Archive className="size-4" aria-hidden />
        {copy.archivedLink(archivedCount)}
      </Link>
    ) : null;

  if (projects.length === 0) {
    return (
      <>
        <PageHeader title={copy.title} description={copy.description} />
        <EmptyState
          icon={House}
          title={copy.emptyTitle}
          description={
            canManage ? copy.emptyDescription : copy.emptyGuestDescription
          }
          action={newProjectLink}
        />
        {archivedLink}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={newProjectLink}
      />
      <ul className="flex flex-col gap-3">
        {projects.map((project) => (
          <li key={project.id}>
            <ProjectCard
              project={project}
              href={orgPath(org.slug, "obras", project.id)}
            />
          </li>
        ))}
      </ul>
      {archivedLink}
    </>
  );
}
