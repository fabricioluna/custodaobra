import { describe, expect, it } from "vitest";

import {
  distinctStages,
  groupDescription,
  splitGroups,
  splitProposalLines,
} from "@/lib/whatsapp/split";

const item = (id: string, totalCents: number, stageId: string | null) => ({
  id,
  description: `Item ${id}`,
  totalCents,
  stageId,
});

describe("splitGroups", () => {
  it("agrupa por etapa na ordem do cupom", () => {
    const groups = splitGroups(
      [item("1", 100, "a"), item("2", 200, "b"), item("3", 300, "a")],
      600,
    );
    expect(groups.map((g) => [g.stageId, g.itemIds, g.amountCents])).toEqual([
      ["a", ["1", "3"], 400],
      ["b", ["2"], 200],
    ]);
  });

  it("reparte o desconto e a soma bate com o total, centavo a centavo", () => {
    const groups = splitGroups(
      [item("1", 8000, "a"), item("2", 7000, "b"), item("3", 5000, null)],
      19000,
    );
    expect(groups.map((g) => g.amountCents)).toEqual([7600, 6650, 4750]);

    const odd = splitGroups(
      [item("1", 100, "a"), item("2", 100, "b"), item("3", 100, "c")],
      1000,
    );
    expect(odd.reduce((sum, g) => sum + g.amountCents, 0)).toBe(1000);
    expect(odd.map((g) => g.amountCents)).toEqual([334, 333, 333]);
  });

  it("conta as etapas diferentes, com sem etapa como uma", () => {
    expect(distinctStages([item("1", 1, "a"), item("2", 1, "a")])).toBe(1);
    expect(distinctStages([item("1", 1, "a"), item("2", 1, null)])).toBe(2);
  });
});

describe("descrição e proposta", () => {
  it("descreve o grupo pelos itens", () => {
    expect(groupDescription(["Fio"])).toBe("Fio");
    expect(groupDescription(["Tubo", "Joelho"])).toBe("Tubo e Joelho");
    expect(groupDescription(["Tubo", "Joelho", "Luva", "Cola"])).toBe(
      "Tubo, Joelho e mais 2",
    );
  });

  it("linhas da proposta com a etapa e o valor", () => {
    const lines = splitProposalLines(
      splitGroups([item("1", 7800, "a"), item("2", 4500, null)], 12300),
      (id) => (id === "a" ? "Alvenaria" : "Sem etapa"),
    ).map((line) => line.replace(/ /g, " "));
    expect(lines).toEqual([
      "• Alvenaria: R$ 78,00 (Item 1)",
      "• Sem etapa: R$ 45,00 (Item 2)",
    ]);
  });
});
