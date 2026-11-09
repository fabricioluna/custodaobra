import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { buildMessageBody: build } = await import("@/lib/whatsapp/client");

/** Parte interativa do corpo (botões ou lista), para conferir os limites. */
type Interactive = {
  interactive?: {
    action: {
      buttons?: { reply: { title: string } }[];
      sections?: { rows: unknown[] }[];
    };
  };
};
const buildMessageBody = (...args: Parameters<typeof build>) =>
  build(...args) as ReturnType<typeof build> & Interactive;

describe("buildMessageBody", () => {
  it("texto simples, sem prévia de link", () => {
    expect(buildMessageBody("5581", { type: "text", body: "Oi" })).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5581",
      type: "text",
      text: { preview_url: false, body: "Oi" },
    });
  });

  it("botões: até 3, título cortado em 20 caracteres", () => {
    const body = buildMessageBody("5581", {
      type: "buttons",
      body: "R$ 300,00 · Mão de obra",
      buttons: [
        { id: "confirm", title: "Confirmar" },
        { id: "edit", title: "Editar este lançamento agora" },
        { id: "cancel", title: "Cancelar" },
      ],
    });
    const buttons = body.interactive?.action.buttons ?? [];
    expect(buttons).toHaveLength(3);
    expect(buttons[1]?.reply.title).toHaveLength(20);
    expect(() =>
      buildMessageBody("5581", {
        type: "buttons",
        body: "x",
        buttons: Array.from({ length: 4 }, (_, i) => ({
          id: `${i}`,
          title: `${i}`,
        })),
      }),
    ).toThrow();
  });

  it("lista: até 10 opções", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: `stage:${i}`,
      title: `Etapa ${i}`,
    }));
    const body = buildMessageBody("5581", {
      type: "list",
      body: "Qual etapa?",
      buttonLabel: "Escolher etapa",
      rows,
    });
    expect(body.interactive?.action.sections?.[0]?.rows).toHaveLength(10);
    expect(() =>
      buildMessageBody("5581", {
        type: "list",
        body: "x",
        buttonLabel: "x",
        rows: [...rows, { id: "a", title: "a" }],
      }),
    ).toThrow();
  });
});
