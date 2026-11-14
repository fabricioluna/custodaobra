export const authCopy = {
  login: {
    title: "Entrar",
    description: "Entre com seu e-mail e senha ou com o Google.",
    google: "Entrar com Google",
    or: "ou",
    emailLabel: "Seu e-mail",
    emailPlaceholder: "voce@exemplo.com",
    passwordLabel: "Senha",
    showPassword: "Mostrar senha",
    hidePassword: "Esconder senha",
    signIn: "Entrar",
    signingIn: "Entrando…",
    forgot: "Esqueci minha senha",
    useCode: "Entrar com código por e-mail",
    noAccount: "Ainda não tem conta?",
    createAccount: "Criar conta",
    haveAccount: "Já tem conta?",
    backToLogin: "Voltar para entrar com senha",
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
    codeOnlyLabel: "Código do e-mail",
    signUp: {
      title: "Criar conta",
      description:
        "Use o e-mail que você confere. Vamos mandar um código para ele uma única vez.",
      passwordLabel: "Crie uma senha",
      passwordHint: "Pelo menos 8 caracteres.",
      submit: "Criar conta",
      submitting: "Criando…",
      confirmTitle: "Confirme seu e-mail",
      confirmDescription: (email: string) =>
        `Mandamos um código para ${email}. Digite aqui para terminar o cadastro. Só precisa fazer isso uma vez.`,
      confirm: "Confirmar e entrar",
    },
    forgotFlow: {
      title: "Criar uma senha nova",
      description:
        "Vale também para quem sempre entrou por código ou pelo Google e ainda não tem senha.",
      submit: "Enviar código",
      sentTitle: "Confira seu e-mail",
      sentDescription: (email: string) =>
        `Se houver uma conta com ${email}, chegou um código. Digite o código e a senha nova.`,
      newPasswordLabel: "Senha nova",
      save: "Salvar senha e entrar",
      saving: "Salvando…",
    },
    legalPrefix: "Ao entrar, você concorda com os ",
    legalTerms: "Termos de Uso",
    legalAnd: " e a ",
    legalPrivacy: "Política de Privacidade",
    legalSuffix: ".",
  },
  errors: {
    invalidEmail: "Digite um e-mail válido, como voce@exemplo.com.",
    invalidCode: "Digite o código de 6 dígitos que chegou no e-mail.",
    wrongCode:
      "Código errado ou vencido. Confira o e-mail ou peça um acesso novo.",
    rateLimited: "Muitos pedidos seguidos. Espere um minuto e tente de novo.",
    wrongPassword:
      "E-mail ou senha errados. Se você sempre entrou por código ou pelo Google, toque em Esqueci minha senha para criar uma.",
    missingPassword: "Digite sua senha.",
    shortPassword: "A senha precisa de pelo menos 8 caracteres.",
    longPassword: "A senha pode ter no máximo 72 caracteres.",
    weakPassword:
      "Essa senha é fácil de adivinhar. Use uma mais longa, misturando letras e números.",
    samePassword: "A senha nova precisa ser diferente da atual.",
    accountExists:
      "Já existe uma conta com este e-mail. Entre com a senha ou, se nunca criou uma, toque em Esqueci minha senha.",
    notConfirmed:
      "Falta confirmar seu e-mail. Mandamos um código novo: digite abaixo.",
    reauthenticate:
      "Por segurança, saia e entre de novo antes de trocar a senha.",
    generic: "Não deu certo agora. Confira a internet e tente de novo.",
    sendFailed:
      "Não deu para enviar o e-mail agora. Tente de novo em instantes.",
    google: "Não deu para entrar com o Google. Tente de novo.",
    link: "Este link venceu, já foi usado ou foi aberto em outro navegador. Peça um novo e abra no mesmo aparelho.",
    account:
      "Sua conta está sem dados de acesso completos. Entre de novo; se continuar, fale com o suporte.",
  },
  signOut: "Sair da conta",
  newPassword: {
    title: "Senha nova",
    description: "Escolha a senha que você vai usar para entrar.",
    label: "Senha nova",
    hint: "Pelo menos 8 caracteres.",
    save: "Salvar senha",
    saving: "Salvando…",
    saved: "Senha salva. Da próxima vez, entre com seu e-mail e esta senha.",
    continue: "Continuar",
  },
} as const;

/** Erros que chegam pela URL (?erro=...) depois de um redirecionamento. */
export const urlErrors = {
  google: authCopy.errors.google,
  link: authCopy.errors.link,
  conta: authCopy.errors.account,
} as const;

export type UrlErrorCode = keyof typeof urlErrors;
