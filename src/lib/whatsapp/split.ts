import { formatCents } from "@/lib/money";

/**
 * Dividir a nota por etapa: cada etapa vira um lançamento, com os itens dela.
 * Regras puras (agrupar, repartir o total, descrever), para testar sem banco.
 */

/** Item do cupom com a etapa escolhida (sugerida pela IA ou pela pessoa). */
export type SplitItem = {
  id: string;
  description: string;
  totalCents: number;
  stageId: string | null;
};

export type SplitGroup = {
  stageId: string | null;
  itemIds: string[];
  descriptions: string[];
  /** Parte do total da nota (com o desconto repartido). */
  amountCents: number;
};

/** Etapas diferentes entre os itens (sem etapa conta como uma). */
export function distinctStages(items: SplitItem[]): number {
  return new Set(items.map((item) => item.stageId)).size;
}

/**
 * Agrupa os itens por etapa, na ordem em que aparecem no cupom, e reparte o
 * total pago entre os grupos na proporção dos itens. O desconto (ou o
 * arredondamento) do cupom fica distribuído e a soma das partes é sempre
 * igual ao total.
 */
export function splitGroups(
  items: SplitItem[],
  totalCents: number,
): SplitGroup[] {
  const groups: SplitGroup[] = [];
  const sums: number[] = [];
  for (const item of items) {
    let index = groups.findIndex((g) => g.stageId === item.stageId);
    if (index < 0) {
      groups.push({
        stageId: item.stageId,
        itemIds: [],
        descriptions: [],
        amountCents: 0,
      });
      sums.push(0);
      index = groups.length - 1;
    }
    groups[index]!.itemIds.push(item.id);
    groups[index]!.descriptions.push(item.description);
    sums[index]! += item.totalCents;
  }

  const itemsTotal = sums.reduce((a, b) => a + b, 0);
  if (itemsTotal <= 0) return groups;

  // Maiores restos: cada grupo recebe a parte inteira e os centavos que
  // sobram vão para os grupos com a maior fração.
  const exact = sums.map((sum) => (sum * totalCents) / itemsTotal);
  const floors = exact.map(Math.floor);
  let left = totalCents - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - floors[index]! }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index]! += 1;
    left -= 1;
  }
  groups.forEach((group, index) => {
    group.amountCents = floors[index]!;
  });
  return groups;
}

/** Descrição do lançamento de um grupo: "Fio 2,5mm", "Tubo e Joelho", "Tubo, Joelho e mais 3". */
export function groupDescription(descriptions: string[]): string {
  const [first, second] = descriptions;
  if (!first) return "Itens do cupom";
  const text =
    descriptions.length === 1
      ? first
      : descriptions.length === 2
        ? `${first} e ${second}`
        : `${first}, ${second} e mais ${descriptions.length - 2}`;
  return text.slice(0, 200);
}

/** Linhas da proposta: "• Alvenaria: R$ 78,00 (Cimento e Areia)". */
export function splitProposalLines(
  groups: SplitGroup[],
  stageName: (stageId: string | null) => string,
): string[] {
  return groups.map(
    (group) =>
      `• ${stageName(group.stageId)}: ${formatCents(group.amountCents)} (${groupDescription(group.descriptions)})`,
  );
}
