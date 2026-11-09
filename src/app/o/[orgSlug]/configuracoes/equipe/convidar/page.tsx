import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { orgPath } from "@/components/layout/nav";
import { PageHeader } from "@/components/layout/page-header";
import { createInvitation } from "@/features/members/actions";
import { InviteForm } from "@/features/members/components/invite-form";
import { membersCopy } from "@/features/members/copy";
import { getOrgRole, isOrgAdminRole } from "@/features/members/queries";
import { requireOrg } from "@/features/organizations/queries";
import { listProjects } from "@/features/projects/queries";
import { isUuid } from "@/lib/forms";

const copy = membersCopy.invite;

export const metadata: Metadata = { title: copy.title };

/** ?obra=<id> já deixa a obra escolhida (atalho das configurações da obra). */
export default async function InvitePage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/configuracoes/equipe/convidar">) {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  const org = await requireOrg(orgSlug);
  if (!isOrgAdminRole(await getOrgRole(org.id))) notFound();

  const projects = await listProjects(org.id);
  const wanted = Array.isArray(query.obra) ? query.obra[0] : query.obra;
  const defaultProjectId =
    isUuid(wanted) && projects.some((p) => p.id === wanted)
      ? wanted
      : undefined;
  const teamHref = orgPath(org.slug, "configuracoes", "equipe");

  return (
    <>
      <BackLink href={teamHref} label={membersCopy.team.back} />
      <PageHeader title={copy.title} description={copy.description} />
      <InviteForm
        action={createInvitation.bind(null, org.slug)}
        projects={projects.map(({ id, name }) => ({ id, name }))}
        defaultProjectId={defaultProjectId}
        teamHref={teamHref}
      />
    </>
  );
}
