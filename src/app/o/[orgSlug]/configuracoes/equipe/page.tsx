import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { orgPath } from "@/components/layout/nav";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { PendingInvitations } from "@/features/members/components/pending-invitations";
import { TeamList } from "@/features/members/components/team-list";
import { membersCopy } from "@/features/members/copy";
import {
  getMaxMembers,
  getOrgRole,
  isOrgAdminRole,
  listPendingInvitations,
  listTeam,
} from "@/features/members/queries";
import { requireOrg } from "@/features/organizations/queries";
import { settingsCopy } from "@/features/settings/copy";
import { requireUserId } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const copy = membersCopy.team;

export const metadata: Metadata = { title: copy.title };

export default async function TeamPage({
  params,
}: PageProps<"/o/[orgSlug]/configuracoes/equipe">) {
  const { orgSlug } = await params;
  const org = await requireOrg(orgSlug);
  const [userId, role] = await Promise.all([
    requireUserId(),
    getOrgRole(org.id),
  ]);
  if (!isOrgAdminRole(role)) notFound();

  const [team, invitations, maxMembers] = await Promise.all([
    listTeam(org.id),
    listPendingInvitations(org.id),
    getMaxMembers(org.id),
  ]);

  return (
    <>
      <BackLink
        href={orgPath(org.slug, "configuracoes")}
        label={settingsCopy.title}
      />
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <Link
            href={orgPath(org.slug, "configuracoes", "equipe", "convidar")}
            className={cn(buttonVariants({ size: "lg" }), "rounded-xl")}
          >
            <UserPlus aria-hidden />
            {copy.invite}
          </Link>
        }
      />

      <div className="flex max-w-2xl flex-col gap-10">
        <section>
          <h2 className="mb-3 text-lg heading">{copy.people}</h2>
          <TeamList
            members={team}
            currentUserId={userId}
            hrefFor={(memberId) =>
              orgPath(org.slug, "configuracoes", "equipe", memberId)
            }
          />
          {maxMembers !== null ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {copy.usage(team.length + invitations.length, maxMembers)}
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="mb-3 text-lg heading">{copy.pendingTitle}</h2>
          <PendingInvitations
            orgSlug={org.slug}
            timezone={org.timezone}
            invitations={invitations}
          />
        </section>
      </div>
    </>
  );
}
