import { CircleAlert, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Mensagem de erro ou de sucesso de um formulário, lida por leitores de tela. */
export function FormMessage({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "success";
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-4 py-3 text-base",
        tone === "error"
          ? "bg-status-danger-soft text-status-danger"
          : "bg-status-ok-soft text-status-ok",
        className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
