import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-prose">
        <h1 className="text-2xl heading md:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-2 text-base text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
