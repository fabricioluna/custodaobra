"use client";

import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Abre a janela de impressão do navegador ("Salvar como PDF"). Troca o
 * título da página só durante a impressão: o navegador usa o título como
 * nome do arquivo.
 */
export function PrintButton({
  label,
  fileTitle,
}: {
  label: string;
  fileTitle: string;
}) {
  function handlePrint() {
    const previous = document.title;
    document.title = fileTitle;
    window.addEventListener(
      "afterprint",
      () => {
        document.title = previous;
      },
      { once: true },
    );
    window.print();
  }

  return (
    <Button
      type="button"
      variant="default"
      size="lg"
      className="rounded-xl"
      onClick={handlePrint}
    >
      <FileDown aria-hidden />
      {label}
    </Button>
  );
}
