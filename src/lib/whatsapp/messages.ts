import { APP_NAME } from "@/config/app";
import { addDays, formatDate, formatRelativeDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";

import { actionId, type StageMode } from "./actions";
import type { ListRow, OutgoingMessage } from "./client";

/**
 * Textos e mensagens que o bot manda. Curtos: a pessoa lê no celular, no
 * canteiro. *negrito* e _itálico_ seguem a formatação do WhatsApp.
 */
export const botMessages = {
  unknownNumber: (signupUrl: string) =>
    `Olá! Este é o WhatsApp do *${APP_NAME}*. Seu número ainda não está ligado a uma conta.\n\nCrie sua conta em ${signupUrl} e depois toque em *Conectar WhatsApp* nas Configurações.`,
  linked: (name: string | null) =>
    `Pronto${name ? `, ${name}` : ""}! Seu WhatsApp está ligado ao *${APP_NAME}*.\n\nPara lançar um gasto, é só mandar o valor e o que foi. Exemplo: _300 pedreiro_`,
  linkInvalid:
    "Esse código não vale mais ou está errado. Gere um novo no app, em Configurações > WhatsApp, e mande de novo.",
  linkMalformed:
    "Para ligar seu número, mande *VINCULAR* seguido dos 6 números que aparecem no app. Exemplo: VINCULAR 123456",
  linkTooManyAttempts:
    "Muitas tentativas com código errado. Espere uma hora, gere um código novo no app e tente de novo.",

  howTo:
    "Para lançar um gasto, mande o valor e o que foi. Exemplos:\n• _300 pedreiro_\n• _2 sacos de cimento 78 na loja do Zé_\n• _ontem 450 de areia no pix_\n\nOu mande a foto (ou o PDF) do cupom ou da nota, ou um áudio falando o gasto.\n\nMande *ajuda* para ver os comandos.",
  help: `Eu lanço os gastos da sua obra no *${APP_NAME}*. Mande o valor e o que foi, por exemplo: _300 pedreiro_ ou _ontem 450 de areia no pix_. Também leio a foto (ou o PDF) do cupom ou da nota e entendo áudio.\n\nComandos:\n• *obras*: ver e trocar a obra\n• *resumo*: quanto já foi gasto na obra\n• *desfazer*: cancela o último lançamento (até 10 minutos)\n• *ajuda*: esta mensagem`,
  projectsQuestion: "Para qual obra vão os próximos gastos?",
  onlyProject: (name: string) =>
    `Sua obra é *${name}*. Os gastos vão para ela.`,
  summaryWhichProject: "De qual obra você quer o resumo?",
  undone: (summary: string) => `↩️ Desfeito. Cancelei:\n${summary}`,
  nothingToUndo:
    "Não achei lançamento seu confirmado nos últimos 10 minutos. Para mudar um gasto mais antigo, use o app.",
  failed:
    "Algo deu errado do meu lado. Confira no app se o gasto foi lançado e, se não foi, mande de novo daqui a pouco.",
  rateLimited:
    "Recebi muitas mensagens em pouco tempo. Espere um minuto e mande de novo.",
  notUnderstood:
    "Não consegui entender esse gasto. Mande o valor e o que foi, por exemplo: _300 pedreiro_",
  onlyText:
    "Por enquanto eu entendo texto, áudio e foto (ou PDF) de cupom. Mande o valor e o que foi, por exemplo: _300 pedreiro_",
  audioUnsupported:
    "Esse tipo de áudio eu não consigo ouvir. Grave uma mensagem de voz pelo WhatsApp ou escreva o gasto, por exemplo: _300 pedreiro_",
  audioTooLarge:
    "Esse áudio é longo demais. Grave uma mensagem curta só com o gasto, por exemplo: _trezentos reais pro pedreiro_",
  audioDownloadFailed:
    "Não consegui abrir esse áudio. Mande de novo daqui a pouco ou escreva o gasto.",
  audioEmpty:
    "Não ouvi nada nesse áudio. Grave de novo falando o valor e o que foi, por exemplo: _trezentos reais pro pedreiro_",
  audioUnavailable:
    "Não consegui ouvir áudio agora. Escreva o gasto, por exemplo: _300 pedreiro_, ou tente de novo em alguns minutos.",
  receiptUnsupported:
    "Esse tipo de arquivo eu não consigo ler. Mande uma foto (JPG ou PNG) ou o PDF do cupom ou da nota.",
  receiptTooLarge:
    "Esse arquivo é grande demais. Mande uma foto do cupom (até 5 MB) ou o PDF (até 10 MB).",
  receiptDownloadFailed:
    "Não consegui abrir esse arquivo. Mande de novo daqui a pouco.",
  notAReceipt:
    "Não achei um cupom, nota ou recibo nessa imagem. Mande a foto do comprovante de perto ou escreva o gasto, por exemplo: _300 pedreiro_",
  receiptNotUnderstood:
    "Não consegui ler esse comprovante. Tente uma foto mais de perto e com boa luz, ou escreva o gasto. Exemplo: _300 pedreiro_",
  askReceiptAmount: (description: string) =>
    `Não consegui ler o total de _${description}_. Qual foi o valor? Mande só o número. Exemplo: 300 ou 1.250,50`,
  askAmount: (description: string) =>
    `Qual foi o valor de _${description}_? Mande só o número. Exemplo: 300 ou 1.250,50`,
  askAmountAgain:
    "Não entendi o valor. Mande só o número, por exemplo: 300 ou 1.250,50",
  confirmed: (summary: string) => `✅ Lançado!\n${summary}`,
  cancelled: "Cancelado. Nada foi lançado.",
  alreadyHandled: "Esse lançamento já foi confirmado ou cancelado.",
  noProjects:
    "Você ainda não tem uma obra em que possa lançar gastos. Crie uma obra no app ou peça para quem te convidou liberar o lançamento.",
  chooseProject: "Em qual obra é esse gasto?",
  chooseProjectButton: "Escolher obra",
  projectSelected: (name: string) =>
    `Obra ativa: *${name}*. Os próximos gastos vão para ela.`,
  limitReached:
    "O limite de lançamentos pelo WhatsApp do seu plano neste mês acabou. Você ainda pode lançar pelo app.",
  whatsappDisabled:
    "O seu plano não inclui lançamentos pelo WhatsApp. Você pode lançar pelo app.",
  unavailable:
    "Não consegui lançar agora. Tente de novo em alguns minutos ou use o app.",

  editPrompt: "O que você quer mudar?",
  editButton: "Escolher",
  stageQuestion: "Em qual etapa? Escolher a etapa já confirma o lançamento.",
  stageEditQuestion: "Qual é a etapa certa?",
  stageButton: "Escolher etapa",
  categoryQuestion: "Qual é a categoria certa?",
  categoryButton: "Escolher categoria",
  dateQuestion: "Em que dia foi o gasto?",
  dateButton: "Escolher dia",
} as const;

export const CATEGORY_NAMES: Record<string, string> = {
  material: "Material",
  mao_de_obra: "Mão de obra",
  servico_terceirizado: "Serviço terceirizado",
  aluguel_equipamentos: "Aluguel de equipamentos",
  frete: "Frete",
  taxas_documentacao: "Taxas e documentação",
  terreno: "Terreno",
  outros: "Outros",
};

const PAYMENT_NAMES: Record<string, string> = {
  pix: "pix",
  dinheiro: "dinheiro",
  cartao_credito: "cartão de crédito",
  cartao_debito: "cartão de débito",
  boleto: "boleto",
  transferencia: "transferência",
  outro: "outro pagamento",
};

export type ExpenseSummary = {
  amountCents: number;
  categoryCode: string;
  stageName: string | null;
  description: string;
  supplierName: string | null;
  spentOn: string;
  paymentMethod: string | null;
  hasInvoice: boolean;
  projectName: string;
  /** Itens lidos do cupom (aparece quando há mais de um). */
  itemCount?: number;
};

/**
 * "R$ 300,00 · Mão de obra · Alvenaria · Pedreiro · hoje · sem nota", com a
 * obra embaixo.
 */
export function formatSummary(expense: ExpenseSummary, today: string): string {
  const parts = [
    `*${formatCents(expense.amountCents)}*`,
    CATEGORY_NAMES[expense.categoryCode] ?? "Outros",
    expense.stageName ?? "Sem etapa",
    expense.description,
    expense.itemCount && expense.itemCount > 1
      ? `${expense.itemCount} itens`
      : null,
    expense.supplierName,
    formatRelativeDate(expense.spentOn, today),
    expense.paymentMethod ? PAYMENT_NAMES[expense.paymentMethod] : null,
    expense.hasInvoice ? "com nota" : "sem nota",
  ].filter(Boolean);
  return `${parts.join(" · ")}\nObra: ${expense.projectName}`;
}

/** Tamanho máximo do trecho ouvido repetido na resposta. */
const HEARD_MAX_LENGTH = 200;

/**
 * O que o bot entendeu de um áudio, antes da resposta, para a pessoa
 * conferir a transcrição (nada da IA vale sem ela ver).
 */
export function heardPrefix(transcript: string): string {
  const text =
    transcript.length > HEARD_MAX_LENGTH
      ? `${transcript.slice(0, HEARD_MAX_LENGTH - 1).trimEnd()}…`
      : transcript;
  return `🎤 _"${text.replaceAll("_", " ")}"_\n\n`;
}

/** Resumo com Confirmar, Editar e Cancelar. */
export function summaryMessage(
  summary: string,
  expenseId: string,
): OutgoingMessage {
  return {
    type: "buttons",
    body: summary,
    buttons: [
      { id: actionId.confirm(expenseId), title: "Confirmar" },
      { id: actionId.edit(expenseId), title: "Editar" },
      { id: actionId.cancel(expenseId), title: "Cancelar" },
    ],
  };
}

/** Lista de até 10 opções: as etapas cabem em páginas de 7 + "Mais etapas". */
const STAGES_PER_PAGE = 7;

export function stageListMessage(input: {
  body: string;
  mode: StageMode;
  stages: { id: string; name: string }[];
  page: number;
  expenseId: string;
}): OutgoingMessage {
  const { stages, mode, expenseId } = input;
  // Até 8 etapas cabem numa página só (com "Sem etapa" e "Cancelar").
  const paged = stages.length > 8;
  const pages = paged ? Math.ceil(stages.length / STAGES_PER_PAGE) : 1;
  const page = Math.min(Math.max(input.page, 0), pages - 1);
  const slice = paged
    ? stages.slice(page * STAGES_PER_PAGE, (page + 1) * STAGES_PER_PAGE)
    : stages;

  const rows: ListRow[] = slice.map((stage) => ({
    id: actionId.stage(mode, stage.id, expenseId),
    title: stage.name,
    ...(stage.name.length > 24 ? { description: stage.name } : {}),
  }));
  if (paged) {
    const next = (page + 1) % pages;
    rows.push({
      id: actionId.stagePage(mode, next, expenseId),
      title: next === 0 ? "Voltar ao início" : "Mais etapas",
      description: `Página ${next + 1} de ${pages}`,
    });
  }
  rows.push({ id: actionId.stage(mode, null, expenseId), title: "Sem etapa" });
  rows.push({
    id: actionId.cancel(expenseId),
    title: "Cancelar lançamento",
  });

  return {
    type: "list",
    body: input.body,
    buttonLabel: botMessages.stageButton,
    rows,
  };
}

export function editMenuMessage(expenseId: string): OutgoingMessage {
  return {
    type: "list",
    body: botMessages.editPrompt,
    buttonLabel: botMessages.editButton,
    rows: [
      { id: actionId.editField("amount", expenseId), title: "Valor" },
      { id: actionId.editField("stage", expenseId), title: "Etapa" },
      { id: actionId.editField("category", expenseId), title: "Categoria" },
      { id: actionId.editField("date", expenseId), title: "Data" },
    ],
  };
}

export function categoryListMessage(expenseId: string): OutgoingMessage {
  return {
    type: "list",
    body: botMessages.categoryQuestion,
    buttonLabel: botMessages.categoryButton,
    rows: Object.entries(CATEGORY_NAMES).map(([code, name]) => ({
      id: actionId.category(code, expenseId),
      title: name,
    })),
  };
}

const WEEKDAY = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  timeZone: "UTC",
});

/** Hoje e os 6 dias anteriores. */
export function dateListMessage(
  today: string,
  expenseId: string,
): OutgoingMessage {
  const rows: ListRow[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, -i);
    const weekday = WEEKDAY.format(new Date(`${date}T12:00:00Z`)).replace(
      ".",
      "",
    );
    const title =
      i === 0 ? "Hoje" : i === 1 ? "Ontem" : `${weekday}, ${formatDate(date)}`;
    return { id: actionId.date(date, expenseId), title };
  });
  return {
    type: "list",
    body: botMessages.dateQuestion,
    buttonLabel: botMessages.dateButton,
    rows,
  };
}

/** Com mais de 10 obras, a lista vai em páginas de 9 + "Mais obras". */
const PROJECTS_PER_PAGE = 9;

export function projectListMessage(
  projects: { id: string; name: string; orgName: string }[],
  showOrg: boolean,
  options: { body?: string; activeId?: string | null; page?: number } = {},
): OutgoingMessage {
  const paged = projects.length > 10;
  const pages = paged ? Math.ceil(projects.length / PROJECTS_PER_PAGE) : 1;
  const page = Math.min(Math.max(options.page ?? 0, 0), pages - 1);
  const slice = paged
    ? projects.slice(page * PROJECTS_PER_PAGE, (page + 1) * PROJECTS_PER_PAGE)
    : projects;
  const rows: ListRow[] = slice.map((project) => {
    const notes = [
      project.id === options.activeId ? "Obra ativa" : null,
      showOrg ? project.orgName : null,
    ].filter(Boolean);
    return {
      id: actionId.project(project.id),
      title: project.name,
      ...(notes.length ? { description: notes.join(" · ") } : {}),
    };
  });
  if (paged) {
    const next = (page + 1) % pages;
    rows.push({
      id: actionId.projectPage(next),
      title: next === 0 ? "Voltar ao início" : "Mais obras",
      description: `Página ${next + 1} de ${pages}`,
    });
  }
  return {
    type: "list",
    body: options.body ?? botMessages.chooseProject,
    buttonLabel: botMessages.chooseProjectButton,
    rows,
  };
}

export type ProjectSummary = {
  projectName: string;
  constructionCents: number;
  landCents: number;
  budgetCents: number;
  committedCents: number;
  unclassifiedCount: number;
  stages: { name: string; spentCents: number; budgetCents: number | null }[];
};

/** Resposta do "resumo": total gasto, previsto e as 5 etapas com mais gasto. */
export function formatProjectSummary(summary: ProjectSummary): string {
  const lines = [`*Resumo · ${summary.projectName}*`];
  lines.push(
    `Gasto na construção: *${formatCents(summary.constructionCents)}*`,
  );
  if (summary.budgetCents > 0) {
    const percent = Math.round(
      (summary.constructionCents / summary.budgetCents) * 100,
    );
    lines.push(
      `Previsto: ${formatCents(summary.budgetCents)} (${percent}% usado)`,
    );
  } else {
    lines.push("Previsto: ainda não definido");
  }
  if (summary.committedCents > 0) {
    lines.push(`Contas a pagar: ${formatCents(summary.committedCents)}`);
  }
  if (summary.landCents > 0) {
    lines.push(`Terreno: ${formatCents(summary.landCents)}`);
  }

  const top = summary.stages
    .filter((stage) => stage.spentCents > 0)
    .sort((a, b) => b.spentCents - a.spentCents)
    .slice(0, 5);
  if (top.length) {
    lines.push("", "Etapas com mais gasto:");
    for (const stage of top) {
      const budget = stage.budgetCents
        ? ` de ${formatCents(stage.budgetCents)}`
        : "";
      lines.push(`• ${stage.name}: ${formatCents(stage.spentCents)}${budget}`);
    }
  } else if (summary.constructionCents === 0) {
    lines.push("", "Nenhum gasto confirmado ainda.");
  }
  if (summary.unclassifiedCount > 0) {
    lines.push(
      "",
      summary.unclassifiedCount === 1
        ? "1 gasto sem etapa: classifique no app."
        : `${summary.unclassifiedCount} gastos sem etapa: classifique no app.`,
    );
  }
  return lines.join("\n");
}

/** "300", "R$ 1.250,50", "300 reais": só o valor, para a pergunta do valor. */
export function parseAmountReply(text: string): string | null {
  const cleaned = text
    .trim()
    .replace(/^r\$\s*/i, "")
    .replace(/\s*(reais|real|conto|contos)\.?$/i, "")
    .trim();
  return /^\d[\d.,]*$/.test(cleaned) ? cleaned : null;
}
