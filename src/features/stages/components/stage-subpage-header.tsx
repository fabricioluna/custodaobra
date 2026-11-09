import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { stagesCopy } from "../copy";

/** Voltar para Etapas, título e descrição de uma subpágina das etapas. */
export function StageSubpageHeader({
  backHref,
  title,
  description,
}: {
  backHref: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <Link
        href={backHref}
        className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {stagesCopy.back}
      </Link>
      <h2 className="text-xl heading">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-prose text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
