import { UserPlus } from "lucide-react";
import Link from "next/link";

import { orgPath } from "@/components/layout/nav";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { membersCopy } from "../copy";
import { listTeam } from "../queries";
import { memberDisplayName } from "./team-list";

const copy = membersCopy.projectPeople;
const { roles } = membersCopy;

/** Quem acessa a obra: administradores (todas) e convidados desta obra. */
export async function ProjectPeople({
  orgId,
  orgSlug,
  projectId,
}: {
  orgId: string;
  orgSlug: string;
  projectId: string;
}) {
  const team = await listTeam(orgId);
  const admins = team.filter((m) => m.role === "owner" || m.role === "admin");
  const guests = team.flatMap((member) => {
    const access = member.projects.find((p) => p.id === projectId);
    return member.role === "member" && access
      ? [{ member, role: access.role }]
      : [];
  });
  const teamHref = orgPath(orgSlug, "configuracoes", "equipe");

  return (
    <section className="mt-10 max-w-xl border-t pt-6">
      <h3 className="text-lg heading">{copy.title}</h3>
      <p className="mt-1 mb-4 text-muted-foreground">{copy.description}</p>

      <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
        {copy.guests}
      </h4>
      {guests.length ? (
        <ul className="mb-5 flex flex-col gap-2">
          {guests.map(({ member, role }) => (
            <li key={member.userId}>
              <Link
                href={`${teamHref}/${member.userId}`}
                className="flex min-h-12 items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2 outline-none hover:border-input focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <span className="truncate font-medium">
                  {memberDisplayName(member)}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {roles[role]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 text-muted-foreground">{copy.empty}</p>
      )}

      <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
        {copy.admins}
      </h4>
      <p className="mb-5">{admins.map(memberDisplayName).join(", ")}</p>

      <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4">
        <Link
          href={`${teamHref}/convidar?obra=${projectId}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "rounded-xl",
          )}
        >
          <UserPlus aria-hidden />
          {copy.invite}
        </Link>
        <Link
          href={teamHref}
          className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
        >
          {copy.manageTeam}
        </Link>
      </div>
    </section>
  );
}
