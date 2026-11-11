export const accountCopy = {
  settingsRow: {
    title: "Seus dados",
    description: "Baixar tudo em planilha ou excluir a conta.",
  },
  page: {
    title: "Seus dados",
    description:
      "Os dados são seus: baixe quando quiser. Se não for mais usar o app, você pode excluir a conta.",
  },
  exportSection: {
    title: "Baixar meus dados",
    description:
      "Uma planilha com tudo o que você vê no app, em todas as contas de que participa: obras, etapas, gastos, itens dos cupons, fornecedores e contas a pagar. As fotos dos comprovantes não vão no arquivo; abra cada uma no gasto.",
    button: "Baixar planilha",
  },
  deleteSection: {
    title: "Excluir minha conta",
    description:
      "Apaga o seu login, o seu nome, o seu número do WhatsApp e as mensagens que você mandou para o bot. Não dá para desfazer.",
    ownedTitle: "Também serão apagadas, com tudo o que há nelas:",
    owned: (name: string, projects: number, others: number) => {
      const obras = projects === 1 ? "1 obra" : `${projects} obras`;
      const pessoas =
        others === 0
          ? ""
          : others === 1
            ? " · 1 outra pessoa perde o acesso"
            : ` · ${others} outras pessoas perdem o acesso`;
      return `${name}: ${obras}, gastos, contas e comprovantes${pessoas}`;
    },
    memberNote:
      "Nas contas de outras pessoas de que você participa, você só sai da equipe. Os gastos que você lançou nelas continuam lá, sem o seu nome.",
    exportFirst: "Antes, baixe a planilha acima se quiser guardar uma cópia.",
    confirmLabel: "Para confirmar, digite EXCLUIR",
    confirmWord: "EXCLUIR",
    button: "Excluir minha conta",
    pending: "Excluindo…",
  },
  errors: {
    confirm: "Digite EXCLUIR, em letras maiúsculas, para confirmar.",
    failed:
      "Não deu para excluir a conta agora. Nada foi apagado do banco; tente de novo em instantes.",
  },
  deleted: {
    title: "Conta excluída",
    description:
      "Seus dados foram apagados. Obrigado por ter usado o app. Se quiser voltar, é só criar uma conta nova.",
    home: "Ir para o início",
  },
  export: {
    fileName: (date: string) => `meus-dados-${date}.xlsx`,
    sheets: {
      profile: "Meus dados",
      accounts: "Contas",
      projects: "Obras",
      stages: "Etapas",
      expenses: "Gastos",
      items: "Itens dos gastos",
      suppliers: "Fornecedores",
      payables: "Contas a pagar",
      attachments: "Comprovantes",
    },
    columns: {
      name: "Nome",
      email: "E-mail",
      whatsapp: "WhatsApp",
      createdAt: "Criado em",
      account: "Conta",
      role: "Papel",
      project: "Obra",
      address: "Endereço",
      city: "Cidade",
      state: "UF",
      area: "Área (m²)",
      costPerM2: "Custo por m²",
      start: "Início",
      end: "Fim previsto",
      status: "Situação",
      archived: "Arquivada em",
      stage: "Etapa",
      order: "Ordem",
      budget: "Previsto",
      progress: "Progresso (%)",
      date: "Data",
      description: "Descrição",
      amount: "Valor",
      category: "Categoria",
      supplier: "Fornecedor",
      payment: "Pagamento",
      invoice: "Nota",
      invoiceNumber: "Nº da nota",
      nfeKey: "Chave da NFC-e",
      quantity: "Quantidade",
      unit: "Unidade",
      unitPrice: "Valor unitário",
      source: "Origem",
      rawInput: "Mensagem original",
      deletedAt: "Excluído em",
      expense: "Gasto",
      item: "Item",
      document: "CPF/CNPJ",
      phone: "Telefone",
      kind: "Tipo",
      dueDate: "Vencimento",
      installment: "Parcela",
      file: "Arquivo",
      type: "Tipo de arquivo",
      sizeKb: "Tamanho (KB)",
    },
    expenseStatus: {
      pending: "Pendente",
      confirmed: "Confirmado",
      cancelled: "Cancelado",
    },
    payableStatus: {
      open: "Aberta",
      paid: "Paga",
      cancelled: "Cancelada",
    },
    sources: {
      app: "App",
      whatsapp_text: "WhatsApp (texto)",
      whatsapp_audio: "WhatsApp (áudio)",
      whatsapp_image: "WhatsApp (foto)",
      import: "Importação",
    },
    supplierKinds: {
      loja: "Loja",
      profissional: "Profissional",
      empresa: "Empresa",
      outro: "Outro",
    },
  },
} as const;
