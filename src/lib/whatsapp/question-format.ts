import { stageStatus } from "@/features/stages/budget";
import type { ExpenseFilters, PayableStatus } from "@/lib/ai/query-tools";
import {
  addDays,
  addMonths,
  formatDate,
  formatMonth,
  formatRelativeDate,
} from "@/lib/dates";
import { formatCents } from "@/lib/money";

import { CATEGORY_NAMES, PAYMENT_NAMES } from "./messages";
import type { QueryAnswer } from "./queries";

/**
 * Respostas das perguntas livres, escritas pelo código a partir do que as
 * consultas devolveram (nenhum número sai da IA). Curtas, para o celular;
 * *negrito* e _itálico_ seguem a formatação do WhatsApp.
 */

export type AnswerContext = {
  /** Hoje no fuso da conta (AAAA-MM-DD). */
  today: string;
  projectName: string;
  stages: { id: string; name: string }[];
};

/** Grupos mostrados na divisão do gasto; o resto vira "Outros". */
const GROUPS_SHOWN = 6;
/** Meses mostrados na divisão por mês (os mais recentes). */
const MONTHS_SHOWN = 12;

const monthLong = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** Último dia do mês de uma data "AAAA-MM-DD". */
const lastDayOfMonth = (isoDate: string) =>
  addDays(addMonths(`${isoDate.slice(0, 7)}-01`, 1), -1);

/**
 * Período em palavras: "outubro de 2026", "2026", "hoje", "de 01/10/2026 a
 * 15/10/2026", "desde 01/03/2026", "até 15/10/2026". Sem período: null.
 */
export function describePeriod(
  from: string | null,
  to: string | null,
  today: string,
): string | null {
  if (!from && !to) return null;
  if (from && !to) return `desde ${formatDate(from)}`;
  if (!from && to) return `até ${formatDate(to)}`;
  const start = from as string;
  const end = to as string;
  if (start === end) return formatRelativeDate(start, today);
  if (start.endsWith("-01-01") && end === `${start.slice(0, 4)}-12-31`) {
    return start.slice(0, 4);
  }
  if (start.endsWith("-01") && end === lastDayOfMonth(start)) {
    return monthLong.format(new Date(`${start}T12:00:00Z`));
  }
  return `de ${formatDate(start)} a ${formatDate(end)}`;
}

/** Filtros em palavras, para o título da resposta. */
export function describeFilters(
  filters: ExpenseFilters,
  context: AnswerContext,
): string[] {
  const stage = filters.stageId
    ? context.stages.find((s) => s.id === filters.stageId)?.name
    : null;
  return [
    describePeriod(filters.from, filters.to, context.today),
    stage ? `etapa ${stage}` : null,
    filters.categoryCode ? CATEGORY_NAMES[filters.categoryCode] : null,
    filters.supplier ? `fornecedor “${filters.supplier}”` : null,
    filters.search ? `“${filters.search}”` : null,
    filters.paymentMethod ? PAYMENT_NAMES[filters.paymentMethod] : null,
  ].filter((part): part is string => Boolean(part));
}

const title = (head: string, parts: string[]) =>
  `*${[head, ...parts].join(" · ")}*`;

const gastos = (count: number) => (count === 1 ? "1 gasto" : `${count} gastos`);

const percentOf = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

/** Sem resultado com busca por palavra: lembra onde a palavra foi procurada. */
function nothingFound(filters: ExpenseFilters): string {
  return filters.search
    ? `Nenhum gasto confirmado com “${filters.search}” na descrição.`
    : "Nenhum gasto confirmado encontrado.";
}

export function formatAnswer(
  answer: QueryAnswer,
  context: AnswerContext,
): string {
  switch (answer.name) {
    case "total_spent":
      return formatTotal(answer, context);
    case "spending_breakdown":
      return formatBreakdown(answer, context);
    case "recent_expenses":
      return formatRecent(answer, context);
    case "budget_status":
      return formatBudget(answer);
    case "payables":
      return formatPayables(answer, context);
  }
}

/** Todas as respostas de uma pergunta, com a obra embaixo. */
export function formatAnswers(
  answers: QueryAnswer[],
  context: AnswerContext,
): string {
  return [
    ...answers.map((answer) => formatAnswer(answer, context)),
    `_Obra: ${context.projectName}_`,
  ].join("\n\n");
}

function formatTotal(
  answer: Extract<QueryAnswer, { name: "total_spent" }>,
  context: AnswerContext,
): string {
  const lines = [title("Gasto", describeFilters(answer.filters, context))];
  if (answer.count === 0) {
    lines.push(nothingFound(answer.filters));
    return lines.join("\n");
  }
  lines.push(`*${formatCents(answer.totalCents)}* em ${gastos(answer.count)}`);
  // Terreno fica fora do custo da construção (CLAUDE.md, seção 5).
  const split =
    !answer.filters.categoryCode &&
    answer.landCents > 0 &&
    answer.landCents < answer.totalCents;
  if (split) {
    lines.push(
      `Construção: ${formatCents(answer.totalCents - answer.landCents)}`,
      `Terreno: ${formatCents(answer.landCents)}`,
    );
  }
  return lines.join("\n");
}

const GROUP_TITLES = {
  stage: "Gasto por etapa",
  category: "Gasto por categoria",
  supplier: "Gasto por fornecedor",
  month: "Gasto por mês",
} as const;

function groupLabel(
  label: string | null,
  groupBy: keyof typeof GROUP_TITLES,
): string {
  if (groupBy === "category") return CATEGORY_NAMES[label ?? ""] ?? "Outros";
  if (groupBy === "month") return label ? formatMonth(`${label}-01`) : "";
  if (label) return label;
  return groupBy === "stage" ? "Sem etapa" : "Sem fornecedor";
}

function formatBreakdown(
  answer: Extract<QueryAnswer, { name: "spending_breakdown" }>,
  context: AnswerContext,
): string {
  const lines = [
    title(
      GROUP_TITLES[answer.groupBy],
      describeFilters(answer.filters, context),
    ),
  ];
  if (answer.count === 0) {
    lines.push(nothingFound(answer.filters));
    return lines.join("\n");
  }

  const byMonth = answer.groupBy === "month";
  // Por mês: os mais recentes, na ordem do calendário.
  const shown = byMonth
    ? answer.groups.slice(-MONTHS_SHOWN)
    : answer.groups.slice(0, GROUPS_SHOWN);
  const rest = byMonth
    ? answer.groups.slice(0, -MONTHS_SHOWN)
    : answer.groups.slice(GROUPS_SHOWN);
  const line = (label: string, cents: number) =>
    `• ${label}: ${formatCents(cents)} (${percentOf(cents, answer.totalCents)}%)`;

  if (byMonth && rest.length) {
    lines.push(line(`Antes (${rest.length} meses)`, sumCents(rest)));
  }
  for (const group of shown) {
    lines.push(line(groupLabel(group.label, answer.groupBy), group.cents));
  }
  if (!byMonth && rest.length) {
    lines.push(line(`Outros (${rest.length})`, sumCents(rest)));
  }
  lines.push(
    `Total: *${formatCents(answer.totalCents)}* em ${gastos(answer.count)}`,
  );
  return lines.join("\n");
}

const sumCents = (groups: { cents: number }[]) =>
  groups.reduce((total, group) => total + group.cents, 0);

function formatRecent(
  answer: Extract<QueryAnswer, { name: "recent_expenses" }>,
  context: AnswerContext,
): string {
  const lines = [
    title("Últimos gastos", describeFilters(answer.filters, context)),
  ];
  if (!answer.items.length) {
    lines.push(nothingFound(answer.filters));
    return lines.join("\n");
  }
  for (const item of answer.items) {
    const parts = [
      formatRelativeDate(item.spentOn, context.today),
      formatCents(item.amountCents),
      item.description,
      item.supplierName,
    ].filter(Boolean);
    lines.push(`• ${parts.join(" · ")}`);
  }
  return lines.join("\n");
}

const LEVEL_ICON = { none: "", ok: "🟢 ", warn: "🟡 ", over: "🔴 " } as const;

function formatBudget(
  answer: Extract<QueryAnswer, { name: "budget_status" }>,
): string {
  if (answer.stageId) {
    const stage = answer.stages[0];
    if (!stage) return "Não achei essa etapa na obra.";
    return formatStageBudget(stage);
  }

  const lines = ["*Orçamento da obra*"];
  // Mesma regra da aba Etapas (summarizePlans): o previsto só se compara com
  // o gasto das etapas que têm previsto; o resto aparece à parte.
  const planned = answer.stages.filter((s) => s.budgetCents !== null);
  const unplanned = answer.stages.filter((s) => s.budgetCents === null);
  const total = (
    stages: typeof answer.stages,
    key: "spentCents" | "committedCents",
  ) => stages.reduce((t, s) => t + s[key], 0);
  if (!planned.length) {
    lines.push(
      `Gasto nas etapas: *${formatCents(total(unplanned, "spentCents"))}*`,
      "O previsto ainda não foi definido. Dá para definir no app, na aba Etapas.",
    );
    return lines.join("\n");
  }

  const budget = planned.reduce((t, s) => t + (s.budgetCents ?? 0), 0);
  const spent = total(planned, "spentCents");
  const committed = total(planned, "committedCents");
  lines.push(
    `Previsto: ${formatCents(budget)}`,
    `Gasto: *${formatCents(spent)}* (${percentOf(spent, budget)}%)`,
  );
  if (committed > 0) lines.push(`Contas a pagar: ${formatCents(committed)}`);
  const left = budget - spent - committed;
  lines.push(
    left >= 0
      ? `Sobra: ${formatCents(left)}`
      : `Passou do previsto: ${formatCents(-left)}`,
  );
  const unplannedSpent = total(unplanned, "spentCents");
  if (unplannedSpent > 0) {
    lines.push(`Gasto em etapas sem previsto: ${formatCents(unplannedSpent)}`);
  }

  const alerts = planned
    .map((stage) => ({ stage, status: stageStatus(stage) }))
    .filter(({ status }) => status.level === "warn" || status.level === "over")
    .sort((a, b) => (b.status.usedPercent ?? 0) - (a.status.usedPercent ?? 0));
  if (alerts.length) {
    lines.push("", "Etapas para olhar:");
    for (const { stage, status } of alerts.slice(0, 5)) {
      lines.push(
        `${LEVEL_ICON[status.level]}${stage.name}: ${formatCents(stage.spentCents + stage.committedCents)} de ${formatCents(stage.budgetCents ?? 0)} (${status.usedPercent ?? 100}%)`,
      );
    }
  } else {
    lines.push("", "🟢 Nenhuma etapa perto de estourar.");
  }
  return lines.join("\n");
}

function formatStageBudget(
  stage: Extract<QueryAnswer, { name: "budget_status" }>["stages"][number],
): string {
  const lines = [`*Orçamento · ${stage.name}*`];
  if (stage.budgetCents === null) {
    lines.push(
      `Gasto: *${formatCents(stage.spentCents)}*`,
      "O previsto desta etapa ainda não foi definido. Dá para definir no app, na aba Etapas.",
    );
    return lines.join("\n");
  }
  const status = stageStatus(stage);
  lines.push(
    `Previsto: ${formatCents(stage.budgetCents)}`,
    `Gasto: *${formatCents(stage.spentCents)}*${status.spentPercent !== null ? ` (${status.spentPercent}%)` : ""}`,
  );
  if (stage.committedCents > 0) {
    lines.push(`Contas a pagar: ${formatCents(stage.committedCents)}`);
  }
  const left = stage.budgetCents - stage.spentCents - stage.committedCents;
  lines.push(
    left >= 0
      ? `${LEVEL_ICON[status.level]}Sobra: ${formatCents(left)}`
      : `${LEVEL_ICON[status.level]}Passou do previsto: ${formatCents(-left)}`,
  );
  if (status.aheadOfProgress) {
    lines.push(
      `Atenção: já foi ${status.spentPercent}% do previsto, e a etapa está em ${stage.progressPercent}% de andamento.`,
    );
  }
  return lines.join("\n");
}

const PAYABLE_TITLES: Record<PayableStatus, string> = {
  overdue: "Contas atrasadas",
  upcoming: "Contas a vencer",
  open: "Contas em aberto",
  paid: "Contas pagas",
};

const PAYABLE_EMPTY: Record<PayableStatus, string> = {
  overdue: "Nenhuma conta atrasada. 👍",
  upcoming: "Nenhuma conta a vencer.",
  open: "Nenhuma conta em aberto.",
  paid: "Nenhuma conta paga.",
};

function formatPayables(
  answer: Extract<QueryAnswer, { name: "payables" }>,
  context: AnswerContext,
): string {
  const period = describePeriod(answer.from, answer.to, context.today);
  const lines = [
    title(
      PAYABLE_TITLES[answer.status],
      period ? [`vencimento ${period}`] : [],
    ),
  ];
  if (answer.count === 0) {
    lines.push(PAYABLE_EMPTY[answer.status]);
    return lines.join("\n");
  }
  lines.push(
    `${answer.count === 1 ? "1 conta" : `${answer.count} contas`} · *${formatCents(answer.totalCents)}*`,
  );
  for (const item of answer.items) {
    const parts = [
      formatRelativeDate(item.dueDate, context.today),
      formatCents(item.amountCents),
      item.description,
      item.supplierName,
    ].filter(Boolean);
    lines.push(`• ${parts.join(" · ")}`);
  }
  if (answer.count > answer.items.length) {
    const more = answer.count - answer.items.length;
    lines.push(
      `…e mais ${more === 1 ? "1 conta" : `${more} contas`}: veja no app, na aba Contas.`,
    );
  }
  return lines.join("\n");
}
