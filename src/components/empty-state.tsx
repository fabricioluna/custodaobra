import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Estado vazio: sempre explica o próximo passo para a pessoa. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="flex max-w-prose flex-col items-start gap-4 py-2">
      <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="size-6" strokeWidth={2} aria-hidden />
      </span>
      <div>
        <h2 className="text-xl heading">{title}</h2>
        <p className="mt-1.5 text-base text-muted-foreground">{description}</p>
      </div>
      {action}
    </section>
  );
}
