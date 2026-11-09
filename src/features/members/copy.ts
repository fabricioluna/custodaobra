export const membersCopy = {
  roles: {
    owner: "Dono da conta",
    admin: "Administrador",
    member: "Convidado",
    editor: "Pode lançar",
    viewer: "Só acompanha",
  },
  roleHints: {
    admin: "Vê e edita todas as obras e cuida da equipe.",
    editor: "Lança e edita gastos, contas e etapas desta obra.",
    viewer: "Vê os gastos e o painel desta obra, sem mudar nada.",
  },
  team: {
    title: "Equipe",
    description:
      "Quem tem acesso às obras desta conta. Cada pessoa entra por um link de convite.",
    invite: "Convidar pessoa",
    people: "Pessoas",
    you: "você",
    noName: "Sem nome",
    allProjects: "Todas as obras",
    noProjects: "Sem acesso a nenhuma obra",
    pendingTitle: "Convites pendentes",
    pendingEmpty: "Nenhum convite esperando resposta.",
    accountWide: "Todas as obras (administrador)",
    expiresOn: (date: string) => `Vale até ${date}`,
    cancel: "Cancelar convite",
    cancelling: "Cancelando…",
    manage: "Gerenciar",
    usage: (used: number, max: number) =>
      `${used} de ${max} pessoas no seu plano (contando convites pendentes).`,
    back: "Equipe",
  },
  invite: {
    title: "Convidar pessoa",
    description:
      "Você gera um link e manda para a pessoa. Ela entra com o e-mail ou o Google e já cai na obra.",
    scope: "Acesso",
    scopeProject: "Só uma obra",
    scopeProjectHint: "Mestre de obras, cliente, alguém da família.",
    scopeAll: "Todas as obras",
    scopeAllHint:
      "Sócio ou alguém que cuida das obras com você (administrador).",
    project: "Obra",
    projectRole: "O que a pessoa pode fazer",
    label: "Nome para lembrar",
    labelOptional: " (opcional)",
    labelPlaceholder: "Ex.: Seu Zé, mestre de obras",
    labelHint: "Só aparece para você, na lista de convites.",
    submit: "Gerar link de convite",
    submitting: "Gerando…",
    noProjects:
      "Cadastre uma obra antes de convidar alguém só para ela. Ou convide para todas as obras.",
    readyTitle: "Link pronto",
    readyDescription:
      "Mande este link para a pessoa. Ele vale por 7 dias e só pode ser usado uma vez. Por segurança, ele não aparece de novo: se perder, cancele e gere outro.",
    copy: "Copiar link",
    copied: "Link copiado",
    sendWhatsapp: "Mandar pelo WhatsApp",
    whatsappMessage: (appName: string, link: string) =>
      `Oi! Estou te convidando para acompanhar a obra no ${appName}: ${link}`,
    another: "Convidar outra pessoa",
    done: "Voltar para a equipe",
  },
  member: {
    titleFallback: "Pessoa da equipe",
    roleTitle: "Papel na conta",
    makeAdmin: "Tornar administrador",
    makeMember: "Deixar só nas obras escolhidas",
    projectsTitle: "Obras",
    projectsDescription:
      "Escolha o que a pessoa pode fazer em cada obra. Administrador já vê todas.",
    noAccess: "Sem acesso",
    save: "Salvar acesso",
    saving: "Salvando…",
    saved: "Acesso atualizado.",
    removeTitle: "Tirar da equipe",
    removeDescription:
      "A pessoa perde o acesso a todas as obras desta conta. Os gastos que ela lançou continuam aqui.",
    remove: "Tirar da equipe",
    removeConfirm: "Tirar esta pessoa da equipe?",
    ownerNote: "O dono da conta não pode ser alterado nem removido.",
  },
  projectPeople: {
    title: "Pessoas desta obra",
    description: "Quem pode ver ou lançar gastos nesta obra.",
    admins: "Administradores (veem todas as obras)",
    guests: "Convidados",
    empty: "Ninguém convidado só para esta obra ainda.",
    invite: "Convidar para esta obra",
    manageTeam: "Ver a equipe toda",
  },
  accept: {
    title: "Convite",
    heading: (inviter: string | null, org: string) =>
      inviter ? `${inviter} convidou você` : `Convite da conta ${org}`,
    toProject: (project: string, role: string) =>
      `Para a obra ${project}: ${role.toLowerCase()}.`,
    toAll: (org: string) =>
      `Para todas as obras da conta ${org}, como administrador.`,
    signInHint:
      "Entre com seu e-mail ou com o Google para aceitar. Se ainda não tem conta, ela é criada na hora.",
    signIn: "Entrar para aceitar",
    nameLabel: "Seu nome",
    nameHint: "É como a equipe vai ver você.",
    accept: "Aceitar convite",
    accepting: "Entrando…",
    invalidTitle: "Convite inválido",
    invalid:
      "Este link de convite não existe. Confira se ele foi copiado inteiro ou peça um novo.",
    expired: "Este convite venceu. Peça um link novo para quem convidou você.",
    revoked:
      "Este convite foi cancelado. Peça um link novo para quem convidou você.",
    used: "Este convite já foi usado por outra pessoa. Peça um link novo para quem convidou você.",
    open: "Abrir o app",
  },
  errors: {
    noPermission: "Só o dono e os administradores cuidam da equipe.",
    saveFailed: "Não deu para salvar agora. Tente de novo em instantes.",
    projectRequired: "Escolha a obra.",
    projectRoleRequired: "Escolha o que a pessoa pode fazer.",
    labelTooLong: "Use no máximo 80 letras.",
    maxMembers: (max: number) =>
      max === 1
        ? "Seu plano permite só 1 pessoa. Cancele um convite pendente ou mude de plano."
        : `Seu plano permite até ${max} pessoas, contando os convites pendentes. Cancele um convite ou tire alguém da equipe.`,
    inactive:
      "Sua assinatura não está ativa. Regularize para convidar pessoas.",
    fullNameRequired: "Digite seu nome.",
    fullNameTooLong: "Use no máximo 120 letras.",
  },
} as const;
