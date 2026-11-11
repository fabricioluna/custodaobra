export const billingCopy = {
  /** Quando a conta não pode criar nada novo (bloqueio suave). */
  inactive:
    "O período de teste ou o plano desta conta acabou. Você continua vendo e baixando tudo, mas para lançar coisas novas o dono da conta precisa escolher um plano.",
  settingsRow: {
    title: "Plano e uso",
    description: "O que o plano permite e o uso deste mês.",
  },
  page: {
    title: "Plano e uso",
    description: "O que o seu plano permite e quanto já foi usado neste mês.",
    plan: "Seu plano",
    usage: "Uso",
    monthNote: "Os contadores do WhatsApp voltam a zero no dia 1º de cada mês.",
    free: "Grátis no lançamento",
    perMonth: "/mês",
    changePlan: "Mudar de plano",
    changePlanSoon:
      "A troca de plano e o pagamento pelo app chegam em breve. Enquanto isso, fale com a gente para mudar de plano.",
  },
  phases: {
    trial: (days: number | null) =>
      days === null
        ? "Em teste"
        : days <= 1
          ? "Em teste · acaba em menos de 24 horas"
          : `Em teste · faltam ${days} dias`,
    trialOver: "Teste encerrado",
    active: "Em dia",
    pastDue: "Pagamento atrasado",
    pastDueOver: "Pagamento atrasado · lançamentos bloqueados",
    cancelled: "Cancelado",
  },
  meters: {
    projects: "Obras ativas",
    members: "Pessoas com acesso (e convites pendentes)",
    whatsappEntries: "Lançamentos pelo WhatsApp neste mês",
    aiCalls: "Leituras da inteligência artificial neste mês",
    aiCallsHint: "Cada mensagem, foto, áudio ou pergunta lida pelo bot.",
    templateMessages: "Avisos do bot neste mês",
    templateMessagesHint: "Alertas de orçamento e resumos semanais.",
    of: (used: string, limit: string) => `${used} de ${limit}`,
    full: "Limite atingido",
  },
  banner: {
    trialEnding: (days: number) =>
      days <= 1
        ? "Seu teste grátis acaba nas próximas 24 horas."
        : `Seu teste grátis acaba em ${days} dias.`,
    cancelled:
      "O plano desta conta foi cancelado. Você ainda vê e baixa tudo, mas não lança coisas novas.",
    trialOver:
      "Seu teste grátis acabou. Você ainda vê tudo, mas não lança gastos novos.",
    pastDue: "A mensalidade está atrasada. Confira o pagamento.",
    pastDueOver:
      "A mensalidade está atrasada. Você ainda vê tudo, mas não lança gastos novos.",
    action: "Ver plano",
  },
} as const;
