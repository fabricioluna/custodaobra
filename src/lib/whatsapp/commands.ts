/**
 * Comandos de texto do bot (CLAUDE.md, seção 6). Só a mensagem inteira vale
 * como comando ("resumo", "Resumo!", "desfazer"): "resumo da obra 300" segue
 * para a leitura do gasto.
 */
export type BotCommand = "help" | "projects" | "summary" | "undo";

const COMMANDS: Record<string, BotCommand> = {
  ajuda: "help",
  help: "help",
  menu: "help",
  comandos: "help",
  obras: "projects",
  obra: "projects",
  "trocar obra": "projects",
  resumo: "summary",
  desfazer: "undo",
};

export function parseCommand(text: string): BotCommand | null {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  // hasOwn: "constructor" e afins não são comandos.
  return Object.hasOwn(COMMANDS, normalized) ? COMMANDS[normalized]! : null;
}
