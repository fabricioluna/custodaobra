export const authCopy = {
  login: {
    title: "Entrar",
    description: "Sem senha: entre com o Google ou pelo seu e-mail.",
    google: "Entrar com Google",
    or: "ou",
    emailLabel: "Seu e-mail",
    emailPlaceholder: "voce@exemplo.com",
    sendCode: "Receber acesso por e-mail",
    sending: "Enviando…",
    sentTitle: "Confira seu e-mail",
    // Enquanto não houver SMTP próprio, o e-mail é o padrão do Supabase: só
    // traz o link. Com o nosso modelo (supabase/templates), traz também o código.
    sentDescription: (email: string) =>
      `Mandamos um e-mail para ${email}. Abra neste mesmo aparelho e toque no link para entrar.`,
    codeLabel: "Ou digite o código, se veio no e-mail",
    verify: "Entrar",
    verifying: "Entrando…",
    useOtherEmail: "Usar outro e-mail",
  },
  errors: {
    invalidEmail: "Digite um e-mail válido, como voce@exemplo.com.",
    invalidCode: "Digite o código de 6 dígitos que chegou no e-mail.",
    wrongCode:
      "Código errado ou vencido. Confira o e-mail ou peça um acesso novo.",
    rateLimited: "Muitos pedidos seguidos. Espere um minuto e tente de novo.",
    sendFailed:
      "Não deu para enviar o e-mail agora. Tente de novo em instantes.",
    google: "Não deu para entrar com o Google. Tente de novo.",
    link: "Este link venceu, já foi usado ou foi aberto em outro navegador. Peça um novo e abra no mesmo aparelho.",
    account:
      "Sua conta está sem dados de acesso completos. Entre de novo; se continuar, fale com o suporte.",
  },
  signOut: "Sair da conta",
} as const;

/** Erros que chegam pela URL (?erro=...) depois de um redirecionamento. */
export const urlErrors = {
  google: authCopy.errors.google,
  link: authCopy.errors.link,
  conta: authCopy.errors.account,
} as const;

export type UrlErrorCode = keyof typeof urlErrors;
