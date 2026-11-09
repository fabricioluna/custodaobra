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
    "Para lançar um gasto, mande o valor e o que foi. Exemplos:\n• _300 pedreiro_\n• _2 sacos de cimento 78 na loja do Zé_\n• _ontem 450 de areia no pix_",
  notUnderstood:
    "Não consegui entender esse gasto. Mande o valor e o que foi, por exemplo: _300 pedreiro_",
  onlyText:
    "Por enquanto eu entendo só mensagens de texto. Mande o valor e o que foi, por exemplo: _300 pedreiro_",
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
    expense.supplierName,
    formatRelativeDate(expense.spentOn, today),
    expense.paymentMethod ? PAYMENT_NAMES[expense.paymentMethod] : null,
    expense.hasInvoice ? "com nota" : "sem nota",
  ].filter(Boolean);
  return `${parts.join(" · ")}\nObra: ${expense.projectName}`;
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

export function projectListMessage(
  projects: { id: string; name: string; orgName: string }[],
  showOrg: boolean,
): OutgoingMessage {
  return {
    type: "list",
    body: botMessages.chooseProject,
    buttonLabel: botMessages.chooseProjectButton,
    rows: projects.slice(0, 10).map((project) => ({
      id: actionId.project(project.id),
      title: project.name,
      ...(showOrg ? { description: project.orgName } : {}),
    })),
  };
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
