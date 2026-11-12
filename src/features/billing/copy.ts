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
    notChargedYet:
      "A cobrança ainda não começou: por enquanto, o uso é grátis. Avisaremos antes de cobrar.",
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
  subscribe: {
    title: "Assinar um plano",
    description:
      "Escolha o plano. Na página de pagamento você paga com Pix, boleto ou cartão.",
    start: "Assinar um plano",
    change: "Mudar de plano",
    plan: "Plano",
    name: "Nome para a cobrança",
    nameHint: "O seu nome ou o da empresa.",
    document: "CPF ou CNPJ",
    documentHint: "Exigido para emitir a cobrança. Só os números.",
    email: "E-mail para receber as faturas",
    submit: "Ir para o pagamento",
    pending: "Preparando o pagamento…",
    trialNote:
      "Se você ainda está no teste grátis, a primeira cobrança vence no fim do teste.",
    changeNote:
      "O novo plano passa a valer quando o próximo pagamento for confirmado.",
    providerDescription: (planName: string, appName: string) =>
      `${appName} · plano ${planName}`,
    none: "Ainda não há planos pagos para assinar.",
  },
  subscription: {
    title: "Sua assinatura",
    nextPlan: (name: string) =>
      `Muda para o plano ${name} no próximo pagamento.`,
    openInvoice: (value: string, due: string) =>
      `Pagar fatura de ${value} (vence ${due})`,
    created:
      "Assinatura criada. A fatura aparece aqui em instantes; o Asaas também manda por e-mail.",
    changed:
      "Plano alterado. Ele passa a valer quando o próximo pagamento for confirmado.",
    cancelTitle: "Cancelar assinatura",
    cancelDescription:
      "As próximas cobranças deixam de ser geradas. A conta continua valendo até o fim do período já pago; depois, você só vê e baixa os dados.",
    cancelConfirm: "Quero cancelar a assinatura",
    cancelSubmit: "Cancelar assinatura",
    cancelPending: "Cancelando…",
  },
  errors: {
    noPermission: "Só o dono ou um administrador da conta mexe no plano.",
    unavailable: "A assinatura pelo app ainda não está disponível.",
    plan: "Escolha um dos planos.",
    name: "Informe o nome para a cobrança.",
    document: "CPF ou CNPJ inválido. Confira os números.",
    email: "Informe um e-mail válido.",
    confirm: "Marque a caixa para confirmar o cancelamento.",
    rejected: (reason: string) => `O sistema de pagamento recusou: ${reason}`,
    failed:
      "Não deu para falar com o sistema de pagamento agora. Tente de novo em instantes.",
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
