import { describe, expect, it } from "vitest";

import { guessCategoryCode } from "@/features/expenses/guess-category";

describe("guessCategoryCode", () => {
  it.each([
    ["pedreiro", "mao_de_obra"],
    ["Diária do servente", "mao_de_obra"],
    ["empreita da laje", "mao_de_obra"],
    ["Eletricista", "mao_de_obra"],
    ["2 sacos de cimento", "material"],
    ["milheiro de tijolo", "material"],
    ["carrada de areia", "material"],
    ["tinta pro pintor", "material"],
    ["frete da areia", "frete"],
    ["aluguel de betoneira", "aluguel_equipamentos"],
    ["Caçamba", "aluguel_equipamentos"],
    ["alvará da prefeitura", "taxas_documentacao"],
    ["ART do engenheiro", "taxas_documentacao"],
    ["ITBI", "terreno"],
    ["escritura", "terreno"],
  ])("%j → %s", (description, code) => {
    expect(guessCategoryCode(description)).toBe(code);
  });

  it("sem pista, não chuta", () => {
    expect(guessCategoryCode("")).toBeNull();
    expect(guessCategoryCode("coisas diversas")).toBeNull();
  });

  it("limpeza do terreno não é compra de terreno", () => {
    expect(guessCategoryCode("limpeza do terreno")).toBeNull();
  });
});
