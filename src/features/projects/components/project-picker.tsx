import { ChevronRight, House } from "lucide-react";
import Link from "next/link";

import { formatCents } from "@/lib/money";

/** Lista de obras para escolher em qual lançar ou ver gastos. */
export function ProjectPicker({
  projects,
  hrefFor,
}: {
  projects: { id: string; name: string; constructionCents: number }[];
  hrefFor: (projectId: string) => string;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={hrefFor(project.id)}
            className="flex min-h-16 items-center gap-4 rounded-2xl border bg-card p-4 outline-none hover:border-input focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <House
              className="size-6 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="flex-1 truncate text-lg font-semibold">
              {project.name}
            </span>
            <span className="text-sm money text-muted-foreground">
              {formatCents(project.constructionCents)}
            </span>
            <ChevronRight
              className="size-5 text-muted-foreground"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
