export const stagesCopy = {
  title: "Etapas",
  description:
    "As etapas da obra, na ordem em que acontecem. Renomeie, reordene ou remova as que não se aplicam.",
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
  },
} as const;
