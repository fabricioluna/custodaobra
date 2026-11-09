"use client";

import type * as React from "react";

import { Input } from "@/components/ui/input";
import { digitsToCents, formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Campo de dinheiro estilo maquininha: a pessoa digita só números e os dois
 * últimos viram centavos ("30000" → R$ 300,00). Abre o teclado numérico e
 * não precisa de vírgula. O formulário recebe os centavos num campo oculto.
 */
export function MoneyInput({
  name,
  cents,
  onCentsChange,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "name"> & {
  name: string;
  cents: number;
  onCentsChange: (cents: number) => void;
}) {
  return (
    <>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={formatCents(0)}
        value={cents > 0 ? formatCents(cents) : ""}
        onChange={(event) => {
          onCentsChange(digitsToCents(event.target.value));
          // Mantém o cursor no fim, onde os números entram.
          const input = event.target;
          requestAnimationFrame(() => {
            const end = input.value.length;
            input.setSelectionRange(end, end);
          });
        }}
        className={cn("money", className)}
      />
      <input type="hidden" name={name} value={cents > 0 ? String(cents) : ""} />
    </>
  );
}
