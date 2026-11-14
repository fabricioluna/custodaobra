import { describe, expect, it } from "vitest";

import { parseCommand } from "@/lib/whatsapp/commands";

describe("parseCommand", () => {
  it.each([
    ["ajuda", "help"],
    ["Ajuda!", "help"],
    ["  MENU ", "help"],
    ["obras", "projects"],
    ["Trocar obra", "projects"],
    ["resumo", "summary"],
    ["Resumo?", "summary"],
    ["desfazer", "undo"],
    ["Desfazer.", "undo"],
  ])("%s → %s", (text, command) => {
    expect(parseCommand(text)).toBe(command);
  });

  it.each([
    "300 pedreiro",
    "resumo da obra 300",
    "desfazer 300",
    "",
    "obras 2",
  ])("%s não é comando", (text) => {
    expect(parseCommand(text)).toBeNull();
  });

  it.each([
    ["nova etapa Muro", "Muro"],
    ["Nova etapa: Piscina.", "Piscina"],
    ["criar etapa  área   gourmet", "área gourmet"],
    ["adicionar uma etapa Garagem", "Garagem"],
    ["nova etapa", ""],
  ])("%s cria a etapa %s", (text, name) => {
    expect(parseCommand(text)).toEqual({ type: "new_stage", name });
  });

  it("gasto que começa com 'nova etapa' e tem valor não é comando", () => {
    expect(parseCommand("nova etapa 300 reais de areia")).toBeNull();
    expect(parseCommand("etapa nova 300")).toBeNull();
  });
});
