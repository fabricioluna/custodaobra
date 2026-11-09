import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/** "‹ Voltar para X", no alto de uma subpágina. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
