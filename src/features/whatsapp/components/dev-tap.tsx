"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";

import { simulateTap } from "../dev-actions";

/** Botão ou opção de lista do bot, clicável no simulador. */
export function DevTap({
  kind,
  id,
  title,
  description,
}: {
  kind: "button" | "list";
  id: string;
  title: string;
  description?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      className="h-auto min-h-9 justify-start rounded-lg py-1.5 text-left"
      onClick={() => start(() => simulateTap(kind, id, title))}
    >
      <span className="flex flex-col">
        <span>{pending ? "Enviando…" : title}</span>
        {description ? (
          <span className="text-xs font-normal text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </Button>
  );
}
