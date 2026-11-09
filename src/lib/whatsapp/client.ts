import "server-only";

import { GRAPH_API_VERSION, whatsappEnv } from "./env";

/**
 * Envio pela WhatsApp Cloud API (oficial da Meta). Texto livre só vale dentro
 * da janela de 24 h depois da última mensagem da pessoa; fora dela, só
 * templates aprovados (Fase 4).
 */

export const MAX_BUTTONS = 3;
export const MAX_BUTTON_TITLE = 20;
export const MAX_LIST_ROWS = 10;
const MAX_LIST_ROW_TITLE = 24;
const MAX_LIST_ROW_DESCRIPTION = 72;
const MAX_TEXT = 4096;

export type ReplyButton = { id: string; title: string };
export type ListRow = { id: string; title: string; description?: string };

export type OutgoingMessage =
  | { type: "text"; body: string }
  | { type: "buttons"; body: string; buttons: ReplyButton[] }
  | {
      type: "list";
      body: string;
      buttonLabel: string;
      rows: ListRow[];
    };

export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: unknown,
  ) {
    super(message);
    this.name = "WhatsAppApiError";
  }
}

function cut(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Corpo da chamada para a Graph API. Puro, para testar os limites. */
export function buildMessageBody(to: string, message: OutgoingMessage) {
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
  };
  switch (message.type) {
    case "text":
      return {
        ...base,
        type: "text",
        text: { preview_url: false, body: cut(message.body, MAX_TEXT) },
      };
    case "buttons":
      if (message.buttons.length < 1 || message.buttons.length > MAX_BUTTONS) {
        throw new Error(`Botões: de 1 a ${MAX_BUTTONS}.`);
      }
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: cut(message.body, 1024) },
          action: {
            buttons: message.buttons.map((button) => ({
              type: "reply",
              reply: {
                id: button.id,
                title: cut(button.title, MAX_BUTTON_TITLE),
              },
            })),
          },
        },
      };
    case "list":
      if (message.rows.length < 1 || message.rows.length > MAX_LIST_ROWS) {
        throw new Error(`Lista: de 1 a ${MAX_LIST_ROWS} opções.`);
      }
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: cut(message.body, 1024) },
          action: {
            button: cut(message.buttonLabel, MAX_BUTTON_TITLE),
            sections: [
              {
                rows: message.rows.map((row) => ({
                  id: row.id,
                  title: cut(row.title, MAX_LIST_ROW_TITLE),
                  ...(row.description
                    ? {
                        description: cut(
                          row.description,
                          MAX_LIST_ROW_DESCRIPTION,
                        ),
                      }
                    : {}),
                })),
              },
            ],
          },
        },
      };
  }
}

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${path}`;
}

async function graphFetch(path: string, init?: RequestInit) {
  const response = await fetch(graphUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${whatsappEnv("WHATSAPP_ACCESS_TOKEN")}`,
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const details: unknown = await response.json().catch(() => null);
    throw new WhatsAppApiError(
      `WhatsApp API respondeu ${response.status}`,
      response.status,
      details,
    );
  }
  return response;
}

/** Envia a mensagem e devolve o id que a Meta deu a ela (wamid). */
export async function sendMessage(
  to: string,
  message: OutgoingMessage,
): Promise<string | null> {
  const phoneNumberId = whatsappEnv("WHATSAPP_PHONE_NUMBER_ID");
  const response = await graphFetch(`${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildMessageBody(to, message)),
  });
  const data = (await response.json()) as { messages?: { id?: string }[] };
  return data.messages?.[0]?.id ?? null;
}

/**
 * Baixa uma mídia recebida (foto, áudio). Primeiro pega a URL temporária,
 * depois o arquivo, as duas vezes com o token.
 */
export async function downloadMedia(
  mediaId: string,
): Promise<{ data: ArrayBuffer; mimeType: string }> {
  const info = (await (await graphFetch(mediaId)).json()) as {
    url?: string;
    mime_type?: string;
  };
  if (!info.url) throw new Error("Mídia sem URL.");
  const file = await fetch(info.url, {
    headers: {
      Authorization: `Bearer ${whatsappEnv("WHATSAPP_ACCESS_TOKEN")}`,
    },
    cache: "no-store",
  });
  if (!file.ok) {
    throw new WhatsAppApiError("Falha ao baixar a mídia.", file.status, null);
  }
  return {
    data: await file.arrayBuffer(),
    mimeType: info.mime_type ?? file.headers.get("content-type") ?? "",
  };
}
