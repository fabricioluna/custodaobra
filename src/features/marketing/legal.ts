import {
  APP_CONTACT_EMAIL,
  APP_DOMAIN,
  APP_NAME,
  LEGAL_ENTITY,
} from "@/config/app";

/**
 * Textos dos Termos de Uso e da Política de Privacidade, revisados por
 * advogado (2026-11-12). Ao mudar algo relevante, troque `updatedAt`, avise
 * quem usa o app e passe de novo pela revisão jurídica.
 */

export type LegalSection = { title: string; paragraphs: string[] };
export type LegalDocument = {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
};

const who = `${LEGAL_ENTITY.name} (${LEGAL_ENTITY.document})`;

export const privacyPolicy: LegalDocument = {
  title: "Política de Privacidade",
  updatedAt: "11 de novembro de 2026",
  intro: `Esta política explica quais dados o ${APP_NAME} (${APP_DOMAIN}) coleta, para que usa, com quem compartilha e como você exerce os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD). O responsável pelo tratamento (controlador) é ${who}.`,
  sections: [
    {
      title: "1. Dados que coletamos",
      paragraphs: [
        "Dados de cadastro: nome, e-mail e, se você entrar com o Google, a foto e o nome da sua conta Google.",
        "Número do WhatsApp, se você conectar o WhatsApp ao app.",
        "Dados das obras: nome, endereço, área, orçamento, etapas, gastos, fornecedores (nome, CPF ou CNPJ e telefone, quando você informa), contas a pagar e as pessoas que você convida.",
        "Comprovantes: fotos e PDFs de cupons, notas e recibos que você envia pelo app ou pelo WhatsApp.",
        "Mensagens do WhatsApp: os textos, fotos e áudios que você manda para o bot, e as respostas dele.",
        "Dados de uso: quantidade de lançamentos e de chamadas à inteligência artificial por mês, para os limites do plano, e registros técnicos (endereço IP, navegador, data e hora) para segurança.",
      ],
    },
    {
      title: "2. Para que usamos",
      paragraphs: [
        "Para prestar o serviço que você contratou: guardar os gastos, calcular os totais, o previsto x realizado e os relatórios, e responder pelo WhatsApp (execução de contrato, art. 7º, V, da LGPD).",
        "Para manter a conta segura, evitar abuso e cumprir obrigações legais (legítimo interesse e cumprimento de obrigação legal, art. 7º, II e IX).",
        "Para mandar avisos que você pode desligar nas configurações, como o alerta de orçamento e o resumo da semana pelo WhatsApp.",
        "Não vendemos os seus dados e não os usamos para publicidade de terceiros.",
      ],
    },
    {
      title: "3. Inteligência artificial",
      paragraphs: [
        "As mensagens, fotos de comprovantes e áudios que você manda para o bot são processados por inteligência artificial para entender o gasto (valor, data, fornecedor, etapa) ou a pergunta. Os textos e fotos são enviados à Anthropic (modelo Claude) e os áudios são transcritos pela Groq. Esses fornecedores processam os dados só para nos devolver o resultado.",
        "Nada do que a inteligência artificial entende é gravado como definitivo sem a sua confirmação. Ela pode errar: confira o resumo antes de confirmar.",
      ],
    },
    {
      title: "4. Com quem compartilhamos",
      paragraphs: [
        "Com as pessoas que você convida para a sua conta ou para uma obra, conforme o acesso que você der a cada uma.",
        "Com os fornecedores que operam o serviço para nós: Supabase (banco de dados, login e armazenamento de arquivos), Vercel (hospedagem), Meta (WhatsApp Cloud API), Anthropic (inteligência artificial), Groq (transcrição de áudio), Resend (envio do e-mail de acesso), Asaas (cobrança da assinatura: nome, CPF ou CNPJ e e-mail de quem paga), Sentry (registro de erros técnicos, sem gravar a sua tela) e Google (login com Google, quando você escolhe essa opção).",
        "Com autoridades, quando a lei ou uma ordem judicial exigir.",
      ],
    },
    {
      title: "5. Transferência internacional",
      paragraphs: [
        "Alguns desses fornecedores guardam ou processam dados fora do Brasil, principalmente nos Estados Unidos. A transferência é feita para executar o contrato com você e com fornecedores que adotam medidas de segurança e confidencialidade compatíveis com a LGPD (art. 33).",
      ],
    },
    {
      title: "6. Por quanto tempo guardamos",
      paragraphs: [
        "Os dados da conta e das obras ficam guardados enquanto a conta existir.",
        "O conteúdo das mensagens do WhatsApp fica guardado por 90 dias. Depois disso é apagado, e fica só o vínculo com o gasto lançado.",
        "Gastos que vieram do WhatsApp e não foram confirmados são cancelados em 24 horas, e as fotos deles são apagadas.",
        "Ao excluir a conta, apagamos os seus dados pessoais, as contas das quais você é o único dono e os comprovantes delas, exceto o que a lei nos obrigar a guardar.",
      ],
    },
    {
      title: "7. Segurança",
      paragraphs: [
        "Cada conta fica separada das outras no próprio banco de dados, e só quem tem acesso a uma obra consegue ver os dados dela. Os comprovantes ficam num armazenamento privado e só abrem por links temporários. A comunicação com o app é sempre criptografada (HTTPS).",
      ],
    },
    {
      title: "8. Seus direitos",
      paragraphs: [
        "Você pode, a qualquer momento: confirmar se tratamos os seus dados, acessá-los, corrigi-los, pedir a portabilidade, a anonimização, o bloqueio ou a eliminação, saber com quem compartilhamos e revogar consentimentos (art. 18 da LGPD).",
        "Você mesmo pode exportar os seus gastos em planilha e corrigir os seus dados dentro do app. Para os demais pedidos, escreva para " +
          APP_CONTACT_EMAIL +
          ". Respondemos em até 15 dias.",
        "Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).",
      ],
    },
    {
      title: "9. Cookies",
      paragraphs: [
        "Usamos só os cookies necessários para manter você conectado. Não usamos cookies de publicidade.",
      ],
    },
    {
      title: "10. Encarregado e contato",
      paragraphs: [
        `Encarregado pelo tratamento de dados: ${LEGAL_ENTITY.name}, pelo e-mail ${APP_CONTACT_EMAIL}.`,
        "Se esta política mudar de forma relevante, avisamos no app antes de a mudança valer.",
      ],
    },
  ],
};

export const termsOfUse: LegalDocument = {
  title: "Termos de Uso",
  updatedAt: "11 de novembro de 2026",
  intro: `Estes termos valem para o uso do ${APP_NAME} (${APP_DOMAIN}), oferecido por ${who}. Ao criar uma conta, você concorda com eles e com a Política de Privacidade.`,
  sections: [
    {
      title: "1. O serviço",
      paragraphs: [
        `O ${APP_NAME} é um aplicativo para controlar os gastos de obras: lançar despesas pelo app ou pelo WhatsApp, acompanhar o previsto x realizado por etapa, contas a pagar, equipe e relatórios.`,
        "O app é uma ferramenta de organização. Não presta serviço de engenharia, arquitetura, contabilidade ou consultoria financeira. Os percentuais das etapas e a estimativa por m² são referências aproximadas, que você deve ajustar com o orçamento real da sua obra.",
      ],
    },
    {
      title: "2. Sua conta",
      paragraphs: [
        "Você precisa informar dados verdadeiros e manter o acesso ao seu e-mail e ao seu WhatsApp em segurança. Você responde pelo que for feito na sua conta e pelas pessoas que convidar.",
        "Para usar o app, você precisa ter pelo menos 18 anos.",
      ],
    },
    {
      title: "3. Inteligência artificial e WhatsApp",
      paragraphs: [
        "O bot usa inteligência artificial para entender mensagens, fotos e áudios. Ele pode errar. Todo gasto mostrado pelo bot só é gravado depois que você confirma, e a conferência é sua.",
        "O uso pelo WhatsApp também está sujeito aos termos da Meta. Mensagens que o bot manda por conta própria, como alertas e resumos, podem ser desligadas nas configurações.",
      ],
    },
    {
      title: "4. Planos, teste e pagamento",
      paragraphs: [
        "Toda conta nova começa com um período de teste gratuito. Os planos, os limites (obras, pessoas, lançamentos pelo WhatsApp e perguntas ao bot) e os preços estão na página de preços.",
        "Ao atingir um limite do plano, você continua vendo todos os seus dados, mas não cria além do limite até mudar de plano ou começar um novo mês.",
        "Você pode cancelar quando quiser. O cancelamento vale a partir do fim do período já pago, sem multa.",
      ],
    },
    {
      title: "5. Uso permitido",
      paragraphs: [
        "Não é permitido usar o app para atividades ilegais, enviar conteúdo de terceiros sem autorização, tentar acessar dados de outras contas, sobrecarregar o serviço ou copiar o software.",
        "Podemos suspender contas que violem estes termos, avisando antes sempre que possível.",
      ],
    },
    {
      title: "6. Seus dados",
      paragraphs: [
        "Os dados que você lança são seus. Você pode exportá-los a qualquer momento e excluir a conta. O tratamento dos dados segue a Política de Privacidade.",
      ],
    },
    {
      title: "7. Disponibilidade e responsabilidade",
      paragraphs: [
        "Trabalhamos para manter o app no ar e os dados seguros, mas o serviço pode ter interrupções, inclusive por falha de fornecedores como a Meta e os provedores de internet.",
        "Não respondemos por decisões tomadas com base nos números do app, por erros em dados lançados ou confirmados pelo usuário, nem por danos indiretos, nos limites permitidos pelo Código de Defesa do Consumidor.",
      ],
    },
    {
      title: "8. Mudanças nestes termos",
      paragraphs: [
        "Se estes termos mudarem de forma relevante, avisamos no app com antecedência. Continuar usando o app depois disso significa aceitar a nova versão.",
      ],
    },
    {
      title: "9. Lei e foro",
      paragraphs: [
        `Estes termos seguem a lei brasileira. Fica eleito o foro do domicílio do consumidor. Dúvidas: ${APP_CONTACT_EMAIL}.`,
      ],
    },
  ],
};
