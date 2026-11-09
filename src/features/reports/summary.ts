/**
 * Contas do relatório da obra, sem banco nem tela (testadas à parte).
 */

/** Custo da construção por m²; nulo sem área ou sem gasto. */
export function perSquareMeterCents(
  constructionCents: number,
  areaM2: number | null,
): number | null {
  if (!areaM2 || areaM2 <= 0 || constructionCents <= 0) return null;
  return Math.round(constructionCents / areaM2);
}

/** Parte do total em % inteiro (0 quando o total é zero). */
export function sharePercent(partCents: number, totalCents: number): number {
  if (totalCents <= 0) return 0;
  return Math.round((partCents / totalCents) * 100);
}

/**
 * Título da página na hora de imprimir: o navegador usa como nome do PDF.
 * "Relatório - Casa do Jardim - 2026-11-09", sem caracteres que dão problema
 * em nome de arquivo.
 */
export function reportFileTitle(projectName: string, today: string): string {
  const name = projectName
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `Relatório - ${name || "obra"} - ${today}`;
}
