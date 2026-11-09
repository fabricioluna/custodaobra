import { UserMinus } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { orgPath } from "@/components/layout/nav";
import { PageHeader } from "@/components/layout/page-header";
import { removeMember, updateMemberAccess } from "@/features/members/actions";
import { ActionButton } from "@/features/members/components/action-button";
import { MemberAccessForm } from "@/features/members/components/member-access-form";
import { memberDisplayName } from "@/features/members/components/team-list";
import { membersCopy } from "@/features/members/copy";
import {
  getOrgRole,
  isOrgAdminRole,
  listTeam,
} from "@/features/members/queries";
import { requireOrg } from "@/features/organizations/queries";
import { listProjects } from "@/features/projects/queries";

const copy = membersCopy.member;

export const metadata: Metadata = { title: copy.titleFallback };

export default async function MemberPage({
  params,
}: PageProps<"/o/[orgSlug]/configuracoes/equipe/[userId]">) {
  const { orgSlug, userId } = await params;
  const org = await requireOrg(orgSlug);
  if (!isOrgAdminRole(await getOrgRole(org.id))) notFound();

  const [team, projects] = await Promise.all([
    listTeam(org.id),
    listProjects(org.id),
  ]);
  const member = team.find((m) => m.userId === userId);
  if (!member) notFound();

  const access = new Map(member.projects.map((p) => [p.id, p.role]));

  return (
    <>
      <BackLink
        href={orgPath(org.slug, "configuracoes", "equipe")}
        label={membersCopy.team.back}
      />
      <PageHeader
        title={memberDisplayName(member)}
        description={
          member.fullName && member.email
            ? member.email
            : membersCopy.roles[member.role]
        }
      />

      {member.role === "owner" ? (
        <p className="max-w-prose text-muted-foreground">{copy.ownerNote}</p>
      ) : (
        <>
          <MemberAccessForm
            action={updateMemberAccess.bind(null, org.slug, member.userId)}
            role={member.role}
            projects={projects.map((project) => ({
              id: project.id,
              name: project.name,
              access: access.get(project.id) ?? "none",
            }))}
          />

          <section className="mt-10 max-w-xl border-t pt-6">
            <h2 className="text-lg heading">{copy.removeTitle}</h2>
            <p className="mt-1 mb-4 text-muted-foreground">
              {copy.removeDescription}
            </p>
            <ActionButton
              action={removeMember.bind(null, org.slug, member.userId)}
              label={copy.remove}
              pendingLabel={copy.saving}
              confirmMessage={copy.removeConfirm}
              icon={<UserMinus aria-hidden />}
              variant="destructive"
            />
          </section>
        </>
      )}
    </>
  );
}
