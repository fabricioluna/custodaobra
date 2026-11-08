import { APP_NAME } from "@/config/app";
import { cn } from "@/lib/utils";

/**
 * Marca do app no cabeçalho e na barra lateral. Hoje é só o nome; quando a
 * logo vetorial chegar (public/brand/logo.svg), troque aqui e só aqui.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-lg font-extrabold tracking-tight text-brand-white",
        className,
      )}
    >
      {APP_NAME}
    </span>
  );
}
