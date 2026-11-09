export const stagesCopy = {
  title: "Etapas",
  description:
    "As etapas da obra, na ordem em que acontecem. Renomeie, reordene ou remova as que não se aplicam.",
  overview: {
    description:
      "Quanto cada etapa já gastou perto do previsto, e quanto a obra andou.",
    budgetLink: "Orçamento",
    progressLink: "Progresso",
    organizeLink: "Organizar etapas",
    noBudgetTitle: "Sem orçamento ainda",
    noBudgetDescription:
      "Defina quanto espera gastar em cada etapa para ver o previsto x realizado e receber alertas antes de estourar.",
    noBudgetAction: "Definir orçamento",
    planned: "Previsto",
    spent: "Gasto",
    committed: "A pagar",
    remaining: "Sobra",
    overBy: "Passou",
    unbudgetedNote: (value: string) =>
      `Mais ${value} gastos em etapas sem previsto (fora da conta acima).`,
  },
  status: {
    none: "Sem previsto",
    ok: "Dentro do previsto",
    warn: "Perto do limite",
    over: "Passou do previsto",
    ahead: "Gasto à frente do andamento",
    aheadDetail: (spent: number, progress: number) =>
      `Já gastou ${spent}% do previsto, mas a etapa está ${progress}% pronta.`,
  },
  plan: {
    spentOf: (spent: string, budget: string) => `${spent} de ${budget}`,
    usedPercent: (value: number) => `${value}%`,
    committed: (value: string) => `+ ${value} a pagar`,
    progress: (value: number) => `${value}% pronta`,
  },
  budget: {
    title: "Orçamento",
    description:
      "Quanto você espera gastar em cada etapa. Deixe em branco a etapa que ainda não sabe.",
    estimateTitle: "Estimativa rápida",
    estimateDescription:
      "Área × custo por m², dividido pelas etapas em percentuais de referência. É só uma estimativa: ajuste etapa por etapa depois.",
    areaLabel: "Área construída (m²)",
    costLabel: "Custo por m²",
    costHint:
      "Use o valor do seu orçamento ou o CUB do seu estado (publicado pelo Sinduscon). O app não busca esse valor sozinho.",
    estimateTotal: (value: string) => `Estimativa: ${value}`,
    apply: "Preencher as etapas",
    confirmOverwrite:
      "Isso troca os valores que já estão preenchidos pela estimativa. Continuar?",
    estimateApplied:
      "Etapas preenchidas com a estimativa. Confira e toque em Salvar.",
    noPercentNote:
      "Etapas que você criou não entram na estimativa: preencha à mão.",
    stageLabel: (name: string) => `Previsto para ${name}`,
    total: "Total previsto",
    save: "Salvar orçamento",
    saving: "Salvando…",
    saved: "Orçamento salvo.",
  },
  progress: {
    title: "Progresso",
    description:
      "Quanto cada etapa já está pronta, no seu olhar. Serve para comparar com o que já foi gasto.",
    stageLabel: (name: string) => `Quanto ${name} está pronta`,
    option: (value: number) => `${value}%`,
    spentHint: (value: number) => `Gasto: ${value}% do previsto`,
    save: "Salvar progresso",
    saving: "Salvando…",
    saved: "Progresso salvo.",
  },
  organize: {
    title: "Organizar etapas",
  },
  back: "Etapas",
  readOnly: "Você só pode ver as etapas desta obra.",
  nameLabel: (position: number) => `Nome da etapa ${position}`,
  save: "Salvar",
  moveUp: (name: string) => `Subir ${name}`,
  moveDown: (name: string) => `Descer ${name}`,
  remove: (name: string) => `Remover ${name}`,
  confirmRemove: (name: string, count: number) =>
    count > 0
      ? `Remover "${name}"? ${count === 1 ? "O gasto desta etapa vai" : `Os ${count} gastos desta etapa vão`} para "Para classificar".`
      : `Remover "${name}"?`,
  expenses: (count: number) =>
    count === 0 ? "Sem gastos" : count === 1 ? "1 gasto" : `${count} gastos`,
  addLabel: "Nova etapa",
  addPlaceholder: "Ex.: Muro e portão",
  add: "Adicionar",
  emptyTitle: "Nenhuma etapa",
  emptyDescription:
    "Adicione as etapas da sua obra para separar os gastos por fase.",
  errors: {
    nameRequired: "Digite o nome da etapa.",
    nameTooLong: "Use no máximo 80 letras.",
    noPermission: "Você não tem permissão para mudar as etapas desta obra.",
    saveFailed: "Não deu para salvar agora. Tente de novo em instantes.",
    invalidAmount: "Valor grande demais.",
    invalidProgress: "Escolha um progresso entre 0% e 100%.",
    invalidArea: "Digite a área em m², por exemplo 120 ou 85,5.",
  },
} as const;
