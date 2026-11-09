import { Archive, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { orgPath } from "@/components/layout/nav";
import { PageHeader } from "@/components/layout/page-header";
import { requireOrg } from "@/features/organizations/queries";
import { ProjectCard } from "@/features/projects/components/project-card";
import { projectsCopy } from "@/features/projects/copy";
import { listProjects } from "@/features/projects/queries";

const copy = projectsCopy.archived;

export const metadata: Metadata = { title: copy.title };

export default async function ArchivedProjectsPage({
  params,
}: PageProps<"/o/[orgSlug]/obras/arquivadas">) {
  const { orgSlug } = await params;
  const org = await requireOrg(orgSlug);
  const projects = await listProjects(org.id, { archived: "only" });

  return (
    <>
      <Link
        href={orgPath(org.slug, "obras")}
        className="mb-2 -ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {copy.back}
      </Link>
      <PageHeader title={copy.title} description={copy.description} />
      {projects.length === 0 ? (
        <EmptyState
          icon={Archive}
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      ) : (
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
      )}
    </>
  );
}
