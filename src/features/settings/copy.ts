export const settingsCopy = {
  title: "Configurações",
  description: "Sua conta, sua equipe, seu plano e o WhatsApp.",
  account: "Conta",
  accountsTitle: "Suas contas",
  accountsDescription:
    "Você participa de mais de uma conta. Toque para trocar.",
  current: "atual",
  team: "Equipe",
  teamDescription: (people: number) =>
    people === 1
      ? "Só você por enquanto. Convide quem vai acompanhar a obra."
      : `${people} pessoas com acesso.`,
  comingSoonTitle: "Em breve",
  comingSoonDescription: "O plano da conta e o uso do mês vão aparecer aqui.",
  privacy: "Privacidade",
} as const;
