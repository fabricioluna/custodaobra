import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { buildMessageBody: build, sendMessage } =
  await import("@/lib/whatsapp/client");

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

describe("sendMessage", () => {
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status });
  const notAllowed = () =>
    reply(400, { error: { code: 131030, message: "not in allowed list" } });

  const mockFetch = (...responses: Response[]) => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push((JSON.parse(String(init.body)) as { to: string }).to);
        return responses.shift() ?? reply(500, {});
      }),
    );
    return calls;
  };

  beforeEach(() => {
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "token");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("número de teste sem o nono dígito: tenta com o 9", async () => {
    const calls = mockFetch(
      notAllowed(),
      reply(200, { messages: [{ id: "wamid.ok" }] }),
    );
    await expect(
      sendMessage("558791728787", { type: "text", body: "oi" }),
    ).resolves.toBe("wamid.ok");
    expect(calls).toEqual(["558791728787", "5587991728787"]);
  });

  it("outros erros não tentam de novo", async () => {
    const calls = mockFetch(reply(401, { error: { code: 190 } }));
    await expect(
      sendMessage("558791728787", { type: "text", body: "oi" }),
    ).rejects.toThrow("(#190)");
    expect(calls).toHaveLength(1);
  });

  it("sem outra forma do número, devolve o erro", async () => {
    const calls = mockFetch(notAllowed(), notAllowed());
    await expect(
      sendMessage("558791728787", { type: "text", body: "oi" }),
    ).rejects.toThrow("(#131030)");
    expect(calls).toHaveLength(2);
  });
});
