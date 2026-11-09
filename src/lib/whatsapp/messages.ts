import { APP_NAME } from "@/config/app";

/**
 * Textos que o bot manda. Curtos: a pessoa lê no celular, no canteiro.
 * *negrito* e _itálico_ seguem a formatação do WhatsApp.
 */
export const botMessages = {
  unknownNumber: (signupUrl: string) =>
    `Olá! Este é o WhatsApp do *${APP_NAME}*. Seu número ainda não está ligado a uma conta.\n\nCrie sua conta em ${signupUrl} e depois toque em *Conectar WhatsApp* nas Configurações.`,
  linked: (name: string | null) =>
    `Pronto${name ? `, ${name}` : ""}! Seu WhatsApp está ligado ao *${APP_NAME}*.\n\nEm breve você vai poder lançar gastos da obra por aqui, só mandando uma mensagem.`,
  linkInvalid:
    "Esse código não vale mais ou está errado. Gere um novo no app, em Configurações > WhatsApp, e mande de novo.",
  linkMalformed:
    "Para ligar seu número, mande *VINCULAR* seguido dos 6 números que aparecem no app. Exemplo: VINCULAR 123456",
  linkTooManyAttempts:
    "Muitas tentativas com código errado. Espere uma hora, gere um código novo no app e tente de novo.",
  comingSoon: `Seu número está ligado ao *${APP_NAME}*. Lançar gastos por mensagem chega em breve. Por enquanto, use o app.`,
} as const;
