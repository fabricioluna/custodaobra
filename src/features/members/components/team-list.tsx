import { ChevronRight, UserRound } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { membersCopy } from "../copy";
import type { TeamMember } from "../queries";

const copy = membersCopy.team;
const { roles } = membersCopy;

/** Nome para mostrar: o nome da pessoa, o e-mail ou "Sem nome". */
export function memberDisplayName(
  member: Pick<TeamMember, "fullName" | "email">,
) {
  return member.fullName?.trim() || member.email || copy.noName;
}

/** O que a pessoa acessa, numa linha: "Todas as obras" ou "Obra 1 (só acompanha)". */
export function memberAccessSummary(member: TeamMember): string {
  if (member.role === "owner" || member.role === "admin")
    return copy.allProjects;
  if (!member.projects.length) return copy.noProjects;
  return member.projects
    .map((p) => `${p.name} (${roles[p.role].toLowerCase()})`)
    .join(", ");
}

/**
 * Pessoas da equipe. O dono aparece sem link (ninguém o altera); os demais
 * abrem a tela de acesso.
 */
export function TeamList({
  members,
  currentUserId,
  hrefFor,
}: {
  members: TeamMember[];
  currentUserId: string;
  hrefFor: (userId: string) => string;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {members.map((member) => {
        const content = (
          <>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <UserRound className="size-5" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-semibold">
                {memberDisplayName(member)}
                {member.userId === currentUserId ? (
                  <span className="font-normal text-muted-foreground">
                    {` (${copy.you})`}
                  </span>
                ) : null}
              </span>
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {roles[member.role]}
                </span>
                {" · "}
                {memberAccessSummary(member)}
              </span>
            </span>
          </>
        );
        const base =
          "flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-4";
        return (
          <li key={member.userId}>
            {member.role === "owner" ? (
              <div className={base}>{content}</div>
            ) : (
              <Link
                href={hrefFor(member.userId)}
                aria-label={`${copy.manage}: ${memberDisplayName(member)}`}
                className={cn(
                  base,
                  "outline-none hover:border-input focus-visible:ring-3 focus-visible:ring-ring/40",
                )}
              >
                {content}
                <ChevronRight
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
