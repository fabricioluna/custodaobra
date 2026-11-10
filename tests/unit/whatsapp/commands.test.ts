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
});
