export const reportsCopy = {
  title: "Relatório da obra",
  link: "Relatório em PDF",
  back: "Painel",
  screenHint:
    'Toque em Salvar em PDF e escolha "Salvar como PDF" na janela de impressão. Também dá para imprimir direto.',
  print: "Salvar em PDF",
  withExpenses: "Incluir a lista de gastos",
  withoutExpenses: "Tirar a lista de gastos",
  generatedOn: (date: string) => `Gerado em ${date}`,
  details: {
    org: "Conta",
    location: "Local",
    area: "Área construída",
    areaValue: (value: string) => `${value} m²`,
    standard: "Padrão",
    start: "Início",
    status: "Situação",
  },
  summary: {
    title: "Resumo",
    construction: "Gasto na construção",
    perSquareMeter: "Custo por m²",
    land: "Terreno",
    total: "Total investido",
    open: "Contas a pagar em aberto",
    overdue: (value: string, count: number) =>
      count === 1
        ? `${value} atrasado (1 conta)`
        : `${value} atrasado (${count} contas)`,
    expenseCount: (count: number) =>
      count === 1 ? "1 gasto lançado" : `${count} gastos lançados`,
  },
  stages: {
    title: "Previsto x realizado por etapa",
    titleNoBudget: "Gasto por etapa",
    noBudgetNote:
      "Esta obra ainda não tem orçamento por etapa: o relatório mostra só o que já foi gasto.",
    stage: "Etapa",
    planned: "Previsto",
    spent: "Gasto",
    committed: "A pagar",
    used: "Usado",
    progress: "Pronta",
    status: "Situação",
    total: "Total",
    remaining: "Sobra do previsto",
    overBy: "Passou do previsto",
    unbudgetedNote: (value: string) =>
      `Mais ${value} gastos em etapas sem previsto (fora do total previsto).`,
    noStageNote: (value: string) =>
      `Mais ${value} gastos ainda sem etapa (fora da tabela).`,
  },
  categories: {
    title: "Por categoria",
    category: "Categoria",
    total: "Total",
    share: "Parte",
  },
  months: {
    title: "Por mês",
    month: "Mês",
    construction: "Construção",
    land: "Terreno",
  },
  payables: {
    title: "Contas a pagar em aberto",
    due: "Vencimento",
    description: "Descrição",
    installment: "Parcela",
    amount: "Valor",
    overdue: "atrasada",
    truncated: (shown: number, total: number) =>
      `Mostrando as ${shown} primeiras de ${total} contas em aberto.`,
  },
  expenses: {
    title: "Gastos lançados",
    date: "Data",
    description: "Descrição",
    stage: "Etapa",
    category: "Categoria",
    supplier: "Fornecedor",
    invoice: "Nota",
    amount: "Valor",
    yes: "sim",
    no: "não",
    total: "Total",
    truncated: (limit: number) =>
      `Mostrando os ${limit} gastos mais recentes. Para a lista completa, baixe a planilha na aba Gastos.`,
  },
  footer:
    "Valores de gastos confirmados. Previsto e percentuais são estimativas informadas na obra, não dados técnicos exatos.",
  empty: "—",
} as const;
