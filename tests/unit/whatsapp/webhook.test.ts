import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  extractMessages,
  messageText,
  verifySignature,
  verifySubscription,
} from "@/lib/whatsapp/webhook";

const SECRET = "segredo-do-app";
const PHONE_NUMBER_ID = "123456789";

const sign = (body: string, secret = SECRET) =>
  `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;

/** Payload no formato que a Meta manda. */
function payload(
  messages: unknown[],
  phoneNumberId = PHONE_NUMBER_ID,
  extra: Record<string, unknown> = {},
) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "5581900000000",
                phone_number_id: phoneNumberId,
              },
              contacts: [{ profile: { name: "Zé" }, wa_id: "558199998888" }],
              messages,
              ...extra,
            },
          },
        ],
      },
    ],
  };
}

const textMessage = (body: string, id = "wamid.1") => ({
  from: "558199998888",
  id,
  timestamp: "1762700000",
  type: "text",
  text: { body },
});

describe("verifySignature", () => {
  const body = JSON.stringify(payload([textMessage("300 pedreiro")]));

  it("aceita a assinatura certa", () => {
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
  });

  it("recusa assinatura com outra chave, corpo alterado ou ausente", () => {
    expect(verifySignature(body, sign(body, "outra"), SECRET)).toBe(false);
    expect(verifySignature(`${body} `, sign(body), SECRET)).toBe(false);
    expect(verifySignature(body, null, SECRET)).toBe(false);
    expect(verifySignature(body, "sha256=abc", SECRET)).toBe(false);
    expect(verifySignature(body, sign(body).slice(7), SECRET)).toBe(false);
  });

  it("sem App Secret configurado, recusa tudo", () => {
    expect(verifySignature(body, sign(body, ""), "")).toBe(false);
  });
});

describe("verifySubscription", () => {
  const params = (token: string, mode = "subscribe") =>
    new URLSearchParams({
      "hub.mode": mode,
      "hub.verify_token": token,
      "hub.challenge": "42",
    });

  it("devolve o challenge com o token certo", () => {
    expect(verifySubscription(params("meu-token"), "meu-token")).toBe("42");
  });

  it("recusa token errado, modo errado ou token não configurado", () => {
    expect(verifySubscription(params("errado"), "meu-token")).toBeNull();
    expect(
      verifySubscription(params("meu-token", "x"), "meu-token"),
    ).toBeNull();
    expect(verifySubscription(params(""), "")).toBeNull();
  });
});

describe("extractMessages", () => {
  it("pega as mensagens do nosso número", () => {
    const messages = extractMessages(
      payload([textMessage("300 pedreiro")]),
      PHONE_NUMBER_ID,
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.id).toBe("wamid.1");
  });

  it("ignora outro número da mesma conta", () => {
    expect(
      extractMessages(payload([textMessage("oi")], "999"), PHONE_NUMBER_ID),
    ).toEqual([]);
  });

  it("ignora avisos de entrega e leitura", () => {
    const statuses = payload([], PHONE_NUMBER_ID, {
      messages: undefined,
      statuses: [{ id: "wamid.1", status: "delivered" }],
    });
    expect(extractMessages(statuses, PHONE_NUMBER_ID)).toEqual([]);
  });

  it("ignora payload que não é do WhatsApp", () => {
    expect(
      extractMessages({ object: "page", entry: [] }, PHONE_NUMBER_ID),
    ).toEqual([]);
    expect(extractMessages(null, PHONE_NUMBER_ID)).toEqual([]);
  });
});

describe("messageText", () => {
  it("lê texto, botão, lista e legenda", () => {
    const [text, button, list, image] = extractMessages(
      payload([
        textMessage("300 pedreiro"),
        {
          ...textMessage("", "wamid.2"),
          type: "interactive",
          text: undefined,
          interactive: {
            type: "button_reply",
            button_reply: { id: "confirm", title: "Confirmar" },
          },
        },
        {
          ...textMessage("", "wamid.3"),
          type: "interactive",
          text: undefined,
          interactive: {
            type: "list_reply",
            list_reply: { id: "stage:1", title: "Fundação" },
          },
        },
        {
          ...textMessage("", "wamid.4"),
          type: "image",
          text: undefined,
          image: { id: "media1", mime_type: "image/jpeg", caption: "cimento" },
        },
      ]),
      PHONE_NUMBER_ID,
    );
    expect(text && messageText(text)).toBe("300 pedreiro");
    expect(button && messageText(button)).toBe("Confirmar");
    expect(list && messageText(list)).toBe("Fundação");
    expect(image && messageText(image)).toBe("cimento");
  });
});
