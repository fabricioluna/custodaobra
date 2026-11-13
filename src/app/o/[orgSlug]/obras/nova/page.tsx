import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormMessage } from "@/components/form-message";
import { PageHeader } from "@/components/layout/page-header";
import { requireOrg } from "@/features/organizations/queries";
import { createProject } from "@/features/projects/actions";
import { ProjectForm } from "@/features/projects/components/project-form";
import { billingCopy } from "@/features/billing/copy";
import { projectsCopy } from "@/features/projects/copy";
import { canManageOrg, listProjects } from "@/features/projects/queries";
import { canCreateProject } from "@/lib/billing/limits";
import { createClient } from "@/lib/supabase/server";

const copy = projectsCopy.create;

export const metadata: Metadata = { title: copy.title };

export default async function NewProjectPage({
  params,
}: PageProps<"/o/[orgSlug]/obras/nova">) {
  const { orgSlug } = await params;
  const org = await requireOrg(orgSlug);
  if (!(await canManageOrg(org.id))) notFound();

  const supabase = await createClient();
  const [projects, allowed] = await Promise.all([
    listProjects(org.id, { archived: "include" }),
    canCreateProject(supabase, org.id),
  ]);
  const isFirst = projects.length === 0;

  return (
    <>
      <PageHeader
        title={isFirst ? copy.firstTitle : copy.title}
        description={copy.description}
      />
      {allowed.ok ? null : (
        <FormMessage className="mb-6 max-w-xl">
          {allowed.reason === "max_projects"
            ? projectsCopy.limit.maxProjects(allowed.limit ?? 1)
            : allowed.reason === "account_suspended"
              ? billingCopy.suspended
              : projectsCopy.limit.inactive}
        </FormMessage>
      )}
      <ProjectForm
        action={createProject.bind(null, org.slug)}
        submitLabel={copy.submit}
        submittingLabel={copy.submitting}
        disabled={!allowed.ok}
      />
      <p className="mt-6 max-w-xl text-sm text-muted-foreground">
        {copy.stagesHint}
      </p>
    </>
  );
}
