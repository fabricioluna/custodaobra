export const whatsappCopy = {
  title: "WhatsApp",
  description: "Lance gastos da obra mandando uma mensagem.",
  rowConnected: (phone: string) => `Ligado ao ${phone}`,
  rowDisconnected: "Conecte seu número para lançar por mensagem.",
  back: "Configurações",

  connectedTitle: "Seu WhatsApp está ligado",
  connectedSince: (phone: string, date: string) => `${phone}, desde ${date}.`,
  disconnect: "Desconectar",
  disconnecting: "Desconectando...",
  disconnectConfirm:
    "Desconectar este número? As mensagens dele deixam de entrar na sua conta.",
  changeNumber: "Trocar de número",

  disconnectedTitle: "Conecte seu WhatsApp",
  steps: [
    "Toque em Conectar WhatsApp.",
    "O WhatsApp abre com uma mensagem pronta. É só enviar.",
    "Volte aqui e toque em Já enviei.",
  ],
  connect: "Conectar WhatsApp",
  connecting: "Gerando código...",

  codeTitle: "Seu código",
  codeHint: (time: string) =>
    `Vale até ${time}. Mande pelo WhatsApp do celular que você vai usar na obra.`,
  openWhatsapp: "Abrir o WhatsApp",
  manualSend: (message: string, bot: string) =>
    `Se o WhatsApp não abrir, mande "${message}" para o número ${bot}.`,
  noBotNumber: (message: string) =>
    `O número do bot ainda não foi configurado. Quando estiver, mande: ${message}`,
  sent: "Já enviei",
  stillWaiting:
    "Ainda não chegou. Confira se a mensagem foi enviada e toque de novo.",
  newCode: "Gerar outro código",

  errors: {
    failed: "Não foi possível gerar o código. Tente de novo.",
    unlinkFailed: "Não foi possível desconectar. Tente de novo.",
  },
} as const;
