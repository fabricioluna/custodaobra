import { ChevronRight, House, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { orgPath } from "@/components/layout/nav";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireOrg } from "@/features/organizations/queries";
import { projectsCopy } from "@/features/projects/copy";
import { canManageOrg, listProjects } from "@/features/projects/queries";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const copy = projectsCopy.list;

export const metadata: Metadata = { title: copy.title };

export default async function ProjectsPage({
  params,
}: PageProps<"/o/[orgSlug]/obras">) {
  const { orgSlug } = await params;
  const org = await requireOrg(orgSlug);
  const [projects, canManage] = await Promise.all([
    listProjects(org.id),
    canManageOrg(org.id),
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

  if (projects.length === 0) {
    return (
      <>
        <PageHeader title={copy.title} description={copy.description} />
        <EmptyState
          icon={House}
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          action={newProjectLink}
        />
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
        {projects.map((project) => {
          const place = [project.city, project.state]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={project.id}>
              <Link
                href={orgPath(org.slug, "obras", project.id)}
                className="flex items-center gap-4 rounded-2xl border bg-card p-4 outline-none hover:border-input focus-visible:ring-3 focus-visible:ring-ring/40 md:p-5"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <House className="size-6" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-lg heading">
                    {project.name}
                  </span>
                  {place ? (
                    <span className="truncate text-sm text-muted-foreground">
                      {place}
                    </span>
                  ) : null}
                </span>
                <span className="flex flex-col items-end gap-0.5 text-right">
                  <span className="text-xs text-muted-foreground">
                    {copy.spent}
                  </span>
                  <span className="text-lg font-bold money">
                    {formatCents(project.constructionCents)}
                  </span>
                </span>
                <ChevronRight
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
