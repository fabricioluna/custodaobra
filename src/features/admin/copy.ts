import { formatDate } from "@/lib/dates";

export const adminCopy = {
  title: "Painel interno",
  description: "Contas, assinaturas, uso e custo estimado da IA no mês.",
  previous: "Mês anterior",
  next: "Próximo mês",
  totals: {
    accounts: "Contas",
    trialing: "Em teste",
    active: "Pagantes",
    expenses: "Gastos lançados no mês",
    whatsapp: "Lançamentos pelo WhatsApp",
    aiCalls: "Leituras da IA",
    aiCost: "Custo estimado da IA",
    templates: "Avisos enviados",
  },
  costNote:
    "Custo da IA estimado pelos tokens do Claude e pelos segundos de áudio da Groq (src/lib/billing/costs.ts). Os avisos da Meta não entram.",
  table: {
    account: "Conta",
    owner: "Dono",
    plan: "Plano",
    status: "Situação",
    projects: "Obras",
    members: "Pessoas",
    expenses: "Gastos no mês",
    whatsapp: "WhatsApp",
    aiCalls: "IA",
    aiCost: "Custo IA",
    access: "Acesso",
    createdAt: "Criada em",
  },
  statuses: {
    trialing: "Em teste",
    active: "Em dia",
    past_due: "Atrasada",
    cancelled: "Cancelada",
  },
  noSubscription: "Sem assinatura",
  access: {
    change: "Alterar",
    back: "Painel interno",
    title: "Acesso da conta",
    description:
      "Libera ou bloqueia esta conta por cima da regra do plano. Bloquear é o bloqueio suave: a conta continua vendo, editando, exportando e excluindo, só não cria nada novo (nem pelo WhatsApp).",
    owner: "Dono",
    plan: "Plano",
    status: "Situação da cobrança",
    now: "Acesso agora",
    mode: "O que fazer",
    modes: {
      normal: {
        label: "Regra normal",
        hint: "Teste, pagamento e cancelamento decidem, como em toda conta.",
      },
      free: {
        label: "Liberar",
        hint: "Pode usar mesmo com o teste vencido, atraso ou plano cancelado. Os limites do plano continuam valendo.",
      },
      blocked: {
        label: "Bloquear",
        hint: "Não cria nada novo, mesmo em dia com o pagamento.",
      },
    },
    date: "Data",
    dateHint:
      "Liberar: último dia liberado; em branco, sem prazo. Bloquear: dia em que o bloqueio começa; em branco, agora.",
    planField: "Plano da conta",
    keepPlan: (name: string) => `Manter (${name})`,
    planHint:
      "Para dar um plano maior sem cobrança. Se a conta pagar pelo Asaas depois, vale o plano pago.",
    note: "Motivo",
    noteHint:
      "Só a equipe vê. Ex.: amigo testando, parceria, falta de pagamento.",
    submit: "Salvar",
    pending: "Salvando…",
    optional: " (opcional)",
    labels: {
      normal: "Regra normal",
      free: "Liberada sem prazo",
      freeUntil: (date: string) => `Liberada até ${formatDate(date)}`,
      freeExpired: "Liberação vencida",
      blocked: "Bloqueada",
      blockedFrom: (date: string) => `Bloqueio a partir de ${formatDate(date)}`,
    },
    errors: {
      mode: "Escolha o que fazer.",
      date: "Data inválida.",
      past: "Essa data já passou.",
      note: "Use até 500 caracteres.",
      noPermission: "Só a equipe do app pode mudar o acesso.",
      plan: "Plano inválido.",
      failed: "Não foi possível salvar. Tente de novo.",
    },
  },
  empty: "Nenhuma conta ainda.",
} as const;
