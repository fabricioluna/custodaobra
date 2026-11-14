/**
 * Comandos de texto do bot (CLAUDE.md, seção 6). Só a mensagem inteira vale
 * como comando ("resumo", "Resumo!", "desfazer"): "resumo da obra 300" segue
 * para a leitura do gasto.
 */
export type SimpleCommand = "help" | "projects" | "summary" | "undo";

/**
 * "nova etapa Muro" cria a etapa na obra ativa. `name` vazio: veio só
 * "nova etapa", sem o nome.
 */
export type NewStageCommand = { type: "new_stage"; name: string };

export type BotCommand = SimpleCommand | NewStageCommand;

const COMMANDS: Record<string, SimpleCommand> = {
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

/**
 * "nova etapa Muro", "criar etapa: Piscina", "adicionar etapa Garagem". O
 * nome mantém o que a pessoa escreveu (acentos e maiúsculas); a pontuação do
 * fim (de um áudio transcrito) sai.
 */
const NEW_STAGE =
  /^\s*(?:nova|novo|criar|crie|adicionar|adicione|incluir)\s+(?:uma\s+)?etapa(?:\s*[:\-–]\s*|\s+|$)(.*)$/iu;

export function parseCommand(text: string): BotCommand | null {
  const newStage = NEW_STAGE.exec(text);
  if (newStage) {
    const name = (newStage[1] ?? "")
      .replace(/[.!?…]+$/u, "")
      .replace(/\s+/g, " ")
      .trim();
    // "nova etapa de 300 reais" não é comando: tem número, é gasto.
    if (!/\d/.test(name)) return { type: "new_stage", name };
  }
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
