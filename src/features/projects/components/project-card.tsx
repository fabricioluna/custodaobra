import { Archive, ChevronRight, House } from "lucide-react";
import Link from "next/link";

import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import { projectsCopy } from "../copy";
import type { ProjectListItem } from "../queries";

const copy = projectsCopy.list;

/** Cartão de uma obra na lista (ativa ou arquivada). */
export function ProjectCard({
  project,
  href,
}: {
  project: ProjectListItem;
  href: string;
}) {
  const place = [project.city, project.state].filter(Boolean).join(" · ");
  const archived = project.archived_at !== null;
  const Icon = archived ? Archive : House;

  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border bg-card p-4 outline-none hover:border-input focus-visible:ring-3 focus-visible:ring-ring/40 md:p-5"
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl",
          archived
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-lg heading">{project.name}</span>
        {archived || place ? (
          <span className="truncate text-sm text-muted-foreground">
            {[archived ? copy.archived : null, place || null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null}
      </span>
      <span className="flex flex-col items-end gap-0.5 text-right">
        <span className="text-xs text-muted-foreground">{copy.spent}</span>
        <span className="text-lg font-bold money">
          {formatCents(project.constructionCents)}
        </span>
      </span>
      <ChevronRight
        className="size-5 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </Link>
  );
}
