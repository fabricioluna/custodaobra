import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { orgPath } from "@/components/layout/nav";
import { projectsCopy } from "@/features/projects/copy";
import { ProjectTabs } from "@/features/projects/components/project-tabs";
import { requireProject } from "@/features/projects/queries";

/**
 * Cabeçalho da obra (nome e abas). Como no layout da organização, a checagem
 * aqui é só experiência: cada página chama requireProject() de novo.
 */
export default async function ProjectLayout({
  children,
  params,
}: LayoutProps<"/o/[orgSlug]/obras/[projectId]">) {
  const { orgSlug, projectId } = await params;
  const { org, project, access } = await requireProject(orgSlug, projectId);
  const base = orgPath(org.slug, "obras", project.id);
  const { tabs } = projectsCopy;

  return (
    <>
      <div className="mb-4">
        <Link
          href={orgPath(org.slug, "obras")}
          className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {projectsCopy.list.title}
        </Link>
        <h1 className="text-2xl heading md:text-4xl">{project.name}</h1>
        {project.archived_at ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-3 text-sm font-semibold text-status-warn">
            {projectsCopy.edit.archivedNotice}
            {access.isOrgAdmin ? (
              <Link
                href={`${base}/configuracoes`}
                className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4"
              >
                {projectsCopy.edit.archivedAction}
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>
      <ProjectTabs
        label={project.name}
        tabs={[
          { href: base, label: tabs.dashboard, exact: true },
          { href: `${base}/lancamentos`, label: tabs.expenses },
          { href: `${base}/etapas`, label: tabs.stages },
          { href: `${base}/contas`, label: tabs.payables },
          { href: `${base}/configuracoes`, label: tabs.settings },
        ]}
      />
      {children}
    </>
  );
}
