import "server-only";

/**
 * Variáveis do WhatsApp, lidas só na hora do uso, para o build funcionar sem
 * elas (CI). Faltando alguma, o webhook responde erro em vez de agir às cegas.
 */
type WhatsAppVar =
  | "WHATSAPP_PHONE_NUMBER_ID"
  | "WHATSAPP_ACCESS_TOKEN"
  | "WHATSAPP_APP_SECRET"
  | "WHATSAPP_VERIFY_TOKEN"
  | "WHATSAPP_LINK_CODE_SECRET";

export function whatsappEnv(name: WhatsAppVar): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não definida.`);
  }
  return value;
}

/** Versão da Graph API usada nas chamadas de envio e de mídia. */
export const GRAPH_API_VERSION = "v26.0";
