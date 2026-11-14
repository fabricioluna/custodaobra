import { APP_NAME } from "@/config/app";

export const marketingCopy = {
  home: {
    login: "Entrar",
  },
  nav: {
    howItWorks: "Como funciona",
    pricing: "Preços",
    login: "Entrar",
  },
  hero: {
    // O título é o APP_TAGLINE.
    description:
      "Mande o gasto da obra pelo WhatsApp, por texto, foto do cupom ou áudio, e acompanhe quanto já foi em cada etapa contra o que estava previsto. A tempo de corrigir o rumo.",
    cta: "Começar grátis",
    secondary: "Ver como funciona",
    note: "7 dias grátis. Sem cartão de crédito.",
  },
  demo: {
    label: "Exemplo de conversa com o bot no WhatsApp",
    botName: APP_NAME,
    status: "online",
    userMessage: "300 pedreiro",
    botSummary: "R$ 300,00 · Mão de obra · Pedreiro · hoje · sem nota",
    botQuestion: "Em qual etapa?",
    choice: "Alvenaria",
    stages: ["Fundação", "Alvenaria", "Cobertura"],
    done: "✅ Lançado!",
    doneSummary:
      "R$ 300,00 · Mão de obra · Alvenaria · Pedreiro · hoje · sem nota",
    time: "07:42",
  },
  steps: {
    title: "Do canteiro para a planilha em 10 segundos",
    items: [
      {
        title: "Mande do jeito que for mais fácil",
        text: "“2 sacos de cimento 78 reais na loja do Zé”, a foto do cupom ou um áudio. O bot entende o jeito de falar de obra.",
      },
      {
        title: "Confira e confirme",
        text: "O bot mostra valor, categoria, etapa e data. Nada é gravado sem o seu toque em Confirmar.",
      },
      {
        title: "Veja onde o dinheiro está indo",
        text: "Cada etapa mostra o previsto e o gasto até agora, com aviso quando passa de 80% ou estoura.",
      },
    ],
  },
  features: {
    title: "Tudo o que a obra precisa, sem planilha",
    items: [
      {
        title: "Previsto x realizado por etapa",
        text: "Fundação, alvenaria, cobertura… Monte o orçamento ou use a estimativa por m² e acompanhe etapa por etapa.",
      },
      {
        title: "Construção e terreno separados",
        text: "O custo por m² mostra só a construção. Lote, ITBI e escritura aparecem no total investido, sem distorcer a conta.",
      },
      {
        title: "Contas a pagar e parcelas",
        text: "Cadastre o que vai vencer, parcele e marque como pago. O que já está comprometido entra na conta do orçamento.",
      },
      {
        title: "Equipe na mesma obra",
        text: "Convide o mestre de obras para lançar, ou o cônjuge e o cliente só para acompanhar.",
      },
      {
        title: "Pergunte ao bot",
        text: "“Quanto gastei com cimento em outubro?” O bot responde com os números da sua obra.",
      },
      {
        title: "Relatório e planilha",
        text: "Relatório da obra em PDF e todos os gastos em planilha, quando você quiser.",
      },
    ],
  },
  audience: {
    title: "Para quem",
    items: [
      {
        title: "Quem está construindo a própria casa",
        text: "Saiba quanto já foi, quanto falta e se o dinheiro vai dar, sem virar contador.",
      },
      {
        title: "Pequeno construtor e empreiteiro",
        text: "Várias obras ao mesmo tempo, cada uma com o seu orçamento, a sua equipe e o seu relatório para o cliente.",
      },
    ],
  },
  pricing: {
    title: "Preços",
    description:
      "Comece com 7 dias grátis em qualquer plano. Depois, escolha o que serve para você.",
    perMonth: "/mês",
    free: "Grátis no lançamento",
    trial: (days: number) => `${days} dias grátis para testar`,
    cta: "Começar grátis",
    unavailable:
      "Os planos estão sendo atualizados. Comece o teste grátis e escolha depois.",
    highlights: {
      pessoal: "Para quem está construindo a própria casa.",
      profissional: "Para quem toca várias obras ao mesmo tempo.",
    } as Record<string, string>,
    projects: (n: number) => (n === 1 ? "1 obra" : `Até ${n} obras`),
    members: (n: number) => `Até ${n} pessoas com acesso`,
    whatsapp: (n: number) =>
      `${n.toLocaleString("pt-BR")} lançamentos por WhatsApp por mês`,
    noWhatsapp: "Lançamentos pelo app",
    included: "Foto do cupom, áudio e perguntas ao bot",
  },
  faq: {
    title: "Perguntas frequentes",
    items: [
      {
        q: "Preciso instalar alguma coisa?",
        a: "Não. Funciona no navegador do celular e pode ser adicionado à tela inicial como um aplicativo. Os lançamentos pelo WhatsApp usam o WhatsApp que você já tem.",
      },
      {
        q: "A inteligência artificial grava os gastos sozinha?",
        a: "Não. O bot lê a mensagem, a foto ou o áudio e mostra o que entendeu. O gasto só entra nas contas depois que você confirma.",
      },
      {
        q: "Quem consegue ver os dados da minha obra?",
        a: "Só você e as pessoas que você convidar. Cada conta fica separada das outras, e você pode baixar todos os seus dados em planilha quando quiser.",
      },
      {
        q: "Serve para reforma?",
        a: "Serve. As etapas vêm prontas para uma construção, mas você renomeia, remove e cria as suas.",
      },
      {
        q: "Os valores de orçamento são exatos?",
        a: "Não. A estimativa por m² e os percentuais por etapa são uma referência para começar. Você ajusta tudo com o orçamento real da sua obra.",
      },
    ],
  },
  finalCta: {
    title: "Comece hoje a sua obra na ponta do lápis",
    cta: "Começar grátis",
  },
  footer: {
    terms: "Termos de Uso",
    privacy: "Política de Privacidade",
    contact: "Contato",
    rights: `© ${APP_NAME}`,
  },
  legal: {
    updatedAt: (date: string) => `Atualizado em ${date}`,
    back: "Voltar para o início",
  },
  notFound: {
    title: "Página não encontrada",
    description:
      "O endereço pode estar errado, ou esta página é de uma conta à qual você não tem acesso.",
    back: "Ir para minhas obras",
  },
  offline: {
    title: "Sem conexão",
    description:
      "Parece que o celular está sem internet. Assim que a conexão voltar, é só abrir de novo.",
  },
} as const;
