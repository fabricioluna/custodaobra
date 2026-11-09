import type { Metadata } from "next";

import { ProjectPeople } from "@/features/members/components/project-people";
import { setProjectArchived, updateProject } from "@/features/projects/actions";
import { ArchiveProjectButton } from "@/features/projects/components/archive-project-button";
import { ProjectForm } from "@/features/projects/components/project-form";
import { projectsCopy } from "@/features/projects/copy";
import { requireProject } from "@/features/projects/queries";
import { formatQuantity } from "@/lib/money";

const copy = projectsCopy.edit;

export const metadata: Metadata = { title: copy.title };

export default async function ProjectSettingsPage({
  params,
}: PageProps<"/o/[orgSlug]/obras/[projectId]/configuracoes">) {
  const { orgSlug, projectId } = await params;
  const { org, project, access } = await requireProject(orgSlug, projectId);
  const archived = project.archived_at !== null;

  return (
    <>
      <h2 className="mb-5 text-xl heading">{copy.title}</h2>
      <ProjectForm
        action={updateProject.bind(null, org.slug, project.id)}
        defaults={{
          name: project.name,
          address: project.address ?? "",
          city: project.city ?? "",
          state: project.state ?? "",
          builtArea:
            project.built_area_m2 !== null
              ? formatQuantity(project.built_area_m2)
              : "",
          standard: project.standard ?? "",
          startDate: project.start_date ?? "",
          status: project.status,
        }}
        submitLabel={copy.submit}
        submittingLabel={copy.submitting}
        showStatus
        disabled={!access.canEdit}
      />

      {access.isOrgAdmin ? (
        <ProjectPeople
          orgId={org.id}
          orgSlug={org.slug}
          projectId={project.id}
        />
      ) : null}

      {access.isOrgAdmin ? (
        <section className="mt-10 max-w-xl border-t pt-6">
          <h3 className="text-lg heading">{copy.archiveTitle}</h3>
          <p className="mt-1 mb-4 text-muted-foreground">
            {copy.archiveDescription}
          </p>
          <ArchiveProjectButton
            action={setProjectArchived.bind(
              null,
              org.slug,
              project.id,
              !archived,
            )}
            archived={archived}
          />
        </section>
      ) : null}
    </>
  );
}
