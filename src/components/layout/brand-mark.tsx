import Image from "next/image";

import { APP_NAME } from "@/config/app";
import { cn } from "@/lib/utils";

/**
 * Marca do app (ícone + nome) no cabeçalho, na barra lateral e no login.
 * Quando a logo vetorial definitiva chegar, troque aqui e só aqui.
 */
export function BrandMark({
  className,
  iconSize = 28,
}: {
  className?: string;
  iconSize?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-brand-white",
        className,
      )}
    >
      <Image
        src="/brand/icon.svg"
        alt=""
        width={iconSize}
        height={iconSize}
        unoptimized
        priority
        className="rounded-md"
      />
      {APP_NAME}
    </span>
  );
}
