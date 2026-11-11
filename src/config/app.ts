/**
 * Identidade do produto. Nunca escreva o nome, o domínio ou o slogan direto
 * em componentes, textos ou metadados: importe daqui.
 */
export const APP_NAME = "Valor da Obra";
export const APP_DOMAIN = "valordaobra.com.br";
export const APP_TAGLINE = "Cada real da sua casa na ponta do lápis";

/** URL pública do app. Em desenvolvimento e preview vem de NEXT_PUBLIC_APP_URL. */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || `https://${APP_DOMAIN}`;

export const APP_LOCALE = "pt-BR";
export const DEFAULT_TIMEZONE = "America/Recife";

/**
 * E-mail de contato e do encarregado de dados (LGPD), no rodapé e nas páginas
 * legais. A caixa precisa existir no domínio antes do lançamento.
 */
export const APP_CONTACT_EMAIL = `contato@${APP_DOMAIN}`;

/**
 * Quem responde pelo serviço nos Termos e na Política de Privacidade
 * (controlador dos dados, LGPD). Preencher antes do lançamento comercial.
 */
export const LEGAL_ENTITY = {
  name: "[nome ou razão social do responsável]",
  document: "[CPF ou CNPJ]",
} as const;
