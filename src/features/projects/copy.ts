export const projectsCopy = {
  list: {
    title: "Obras",
    description: "Acompanhe cada obra separada, com seus gastos e etapas.",
    emptyTitle: "Nenhuma obra ainda",
    emptyDescription:
      "Cadastre sua primeira obra para começar a lançar gastos e acompanhar cada etapa.",
    emptyGuestDescription:
      "Você ainda não tem acesso a nenhuma obra desta conta. Peça a quem convidou você para liberar uma obra.",
    create: "Nova obra",
    spent: "Gasto na construção",
    archived: "Arquivada",
    noExpenses: "Nenhum gasto ainda",
    archivedLink: (count: number) =>
      count === 1 ? "1 obra arquivada" : `${count} obras arquivadas`,
  },
  archived: {
    title: "Obras arquivadas",
    description:
      "Obras guardadas: os gastos continuam aqui, só não aparecem na lista principal.",
    emptyTitle: "Nenhuma obra arquivada",
    emptyDescription:
      "Quando uma obra terminar, arquive nas configurações dela para tirar da lista.",
    back: "Obras",
  },
  create: {
    firstTitle: "Sua primeira obra",
    title: "Nova obra",
    description:
      "Só o nome é obrigatório. O resto ajuda a calcular o custo por m².",
    submit: "Criar obra",
    submitting: "Criando…",
    stagesHint:
      "A obra já nasce com as etapas mais comuns (fundação, alvenaria, pintura…). Dá para renomear, remover e reordenar depois.",
  },
  edit: {
    title: "Dados da obra",
    submit: "Salvar",
    submitting: "Salvando…",
    saved: "Dados salvos.",
    archiveTitle: "Arquivar obra",
    archiveDescription:
      "A obra sai da lista e para de contar no limite do plano. Os gastos continuam guardados.",
    archive: "Arquivar obra",
    unarchive: "Reativar obra",
    archivedNotice: "Esta obra está arquivada.",
    archivedAction: "Reativar nas configurações",
  },
  form: {
    name: "Nome da obra",
    namePlaceholder: "Ex.: Casa do Jardim",
    city: "Cidade",
    state: "UF",
    statePlaceholder: "UF",
    address: "Endereço",
    builtArea: "Área construída (m²)",
    builtAreaHint: "Só a área coberta da casa, sem o terreno.",
    standard: "Padrão de acabamento",
    standardNone: "Não sei ainda",
    startDate: "Início da obra",
    status: "Situação",
  },
  standards: {
    economico: "Econômico",
    normal: "Normal",
    alto: "Alto",
  },
  statuses: {
    planejamento: "Planejamento",
    em_andamento: "Em andamento",
    pausada: "Pausada",
    concluida: "Concluída",
  },
  dashboard: {
    title: "Painel",
    construction: "Gasto na construção",
    land: "Terreno",
    landHint:
      "Compra do lote, ITBI e escritura. Fica fora do custo da construção.",
    perSquareMeter: (value: string) => `${value} por m² construído`,
    totalInvested: (value: string) => `Total investido: ${value}`,
    emptyTitle: "Nenhum gasto ainda",
    emptyDescription:
      "Toque em Lançar gasto ou mande uma mensagem no WhatsApp. O painel atualiza na hora.",
    launch: "Lançar gasto",
    savedNotice: (amount: string) => `Gasto de ${amount} lançado.`,
    savedGeneric: "Gasto lançado.",
    launchAnother: "Lançar outro",
    receiptWarning:
      "O gasto foi salvo, mas a foto do comprovante não subiu. Abra o gasto e tente anexar de novo.",
    unclassifiedTitle: "Para classificar",
    unclassifiedDescription: (count: number) =>
      count === 1
        ? "1 gasto sem etapa. Toque para escolher a etapa."
        : `${count} gastos sem etapa. Toque em cada um para escolher a etapa.`,
    byStage: "Por etapa",
    alertsTitle: "Atenção",
    defineBudget: "Definir orçamento das etapas",
    byStageHint:
      "Defina o previsto de cada etapa para comparar com o gasto e receber alertas antes de estourar.",
    byCategory: "Por categoria",
    byMonth: "Por mês",
    recent: "Últimos gastos",
    seeAll: "Ver todos os gastos",
    payablesTitle: "Contas a pagar",
    payablesSeeAll: "Ver todas as contas",
    noSpending: "—",
  },
  tabs: {
    dashboard: "Painel",
    expenses: "Gastos",
    stages: "Etapas",
    payables: "Contas",
    settings: "Obra",
  },
  limit: {
    title: "Limite do plano",
    maxProjects: (limit: number) =>
      limit === 1
        ? "Seu plano permite 1 obra ativa. Arquive a obra atual ou mude de plano para cadastrar outra."
        : `Seu plano permite ${limit} obras ativas. Arquive uma obra ou mude de plano para cadastrar outra.`,
    inactive:
      "Sua assinatura não está ativa. Os dados continuam aqui, mas não dá para cadastrar obras novas.",
  },
  errors: {
    nameRequired: "Digite o nome da obra.",
    nameTooLong: "Use no máximo 80 letras.",
    cityTooLong: "Use no máximo 80 letras.",
    addressTooLong: "Use no máximo 200 letras.",
    stateInvalid: "Escolha a UF.",
    areaInvalid: "Digite a área em m², como 120 ou 85,5.",
    dateInvalid: "Data inválida.",
    noPermission: "Você não tem permissão para isso nesta obra.",
    saveFailed: "Não deu para salvar agora. Tente de novo em instantes.",
  },
} as const;

/** Unidades federativas, para o seletor de UF. */
export const BRAZIL_STATES = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
] as const;
