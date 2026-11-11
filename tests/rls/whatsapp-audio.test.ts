import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { ExtractionResult } from "@/lib/ai/extract-expense";
import type { TranscriptionResult } from "@/lib/ai/transcribe-audio";
import type { OutgoingMessage } from "@/lib/whatsapp/client";
import type { IncomingMessage } from "@/lib/whatsapp/webhook";

import {
  adminClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

vi.mock("server-only", () => ({}));

// Nada sai para a Meta: guarda o que o bot mandaria e devolve um "áudio".
const sent: OutgoingMessage[] = [];
const downloads: string[] = [];
class MediaTooLargeError extends Error {}
vi.mock("@/lib/whatsapp/client", () => ({
  markReadWithTyping: async () => {},
  sendMessage: async (_to: string, message: OutgoingMessage) => {
    sent.push(message);
    return `wamid.out.${crypto.randomUUID()}`;
  },
  MediaTooLargeError,
  downloadMedia: async (mediaId: string) => {
    downloads.push(mediaId);
    if (mediaId.startsWith("grande-")) throw new MediaTooLargeError("grande");
    return {
      data: new TextEncoder().encode(`voz ${mediaId}`).buffer,
      mimeType: "audio/ogg",
    };
  },
}));

// A Groq e o Claude são trocados por respostas prontas.
const transcribeAudio = vi.fn<() => Promise<TranscriptionResult>>();
vi.mock("@/lib/ai/transcribe-audio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/transcribe-audio")>()),
  transcribeAudio,
}));
const extractExpense = vi.fn<() => Promise<ExtractionResult>>();
vi.mock("@/lib/ai/extract-expense", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/extract-expense")>()),
  extractExpense,
}));

const { handleIncomingMessage } =
  await import("@/lib/whatsapp/handlers/incoming");

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(
    new Date(),
  );

const read = (
  fields: Partial<
    Extract<ExtractionResult, { kind: "expense" }>["expense"]
  > = {},
): ExtractionResult => ({
  kind: "expense",
  usage: { inputTokens: 100, outputTokens: 20 },
  expense: {
    amountCents: 30000,
    description: "Pedreiro",
    stageId: null,
    categoryCode: "mao_de_obra",
    supplierName: null,
    spentOn: today(),
    paymentMethod: null,
    hasInvoice: false,
    quantity: null,
    unit: null,
    confidence: 0.9,
    missing: [],
    ...fields,
  },
});

const heard = (text: string, seconds = 10): TranscriptionResult => ({
  kind: "text",
  text,
  seconds,
});

const randomPhone = () =>
  `55819${Math.floor(60000000 + Math.random() * 39999999)}`;

/**
 * Áudio pelo WhatsApp, como o webhook roda (service role), com a Meta, a
 * Groq e a IA simuladas: a transcrição segue o caminho do texto, o gasto
 * nasce com `source = whatsapp_audio` e a transcrição em `raw_input`, a
 * resposta mostra o que foi ouvido e os segundos contam no uso da conta.
 */
describe("áudio pelo WhatsApp", () => {
  const admin = adminClient();
  let dani: TestUser;
  let phone: string;

  const message = (fields: Partial<IncomingMessage>): IncomingMessage => ({
    id: `wamid.test.${crypto.randomUUID()}`,
    from: phone,
    timestamp: `${Math.floor(Date.now() / 1000)}`,
    type: "text",
    ...fields,
  });
  const voice = (
    mimeType = "audio/ogg; codecs=opus",
    id = `media-${crypto.randomUUID()}`,
  ) => {
    const incoming = message({
      type: "audio",
      audio: { id, mime_type: mimeType },
    });
    return handleIncomingMessage(admin, incoming).then(() => incoming.id);
  };
  const tap = (id: string) =>
    handleIncomingMessage(
      admin,
      message({
        type: "interactive",
        interactive: { type: "list_reply", list_reply: { id, title: "x" } },
      }),
    );
  const last = () => sent.at(-1);
  const optionId = (title: string) => {
    const message = last();
    return message?.type === "list"
      ? (message.rows.find((row) => row.title === title)?.id ?? "")
      : "";
  };
  const latestExpense = async () => {
    const { data } = await admin
      .from("expenses")
      .select("id, status, source, raw_input, amount_cents")
      .eq("org_id", dani.orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  };
  const countExpenses = async () => {
    const { count } = await admin
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("org_id", dani.orgId);
    return count ?? 0;
  };
  const usage = async () => {
    const { data } = await admin
      .from("usage_counters")
      .select("ai_calls, audio_seconds, whatsapp_entries")
      .eq("org_id", dani.orgId)
      .maybeSingle();
    return data;
  };
  const logError = async (waMessageId: string) => {
    const { data } = await admin
      .from("whatsapp_messages")
      .select("error")
      .eq("wa_message_id", waMessageId)
      .single();
    return data?.error;
  };

  beforeAll(async () => {
    dani = await createTestUser("wa-audio-dani");
    phone = randomPhone();
    const { error } = await dani.client.from("projects").insert({
      org_id: dani.orgId,
      name: "Casa do sítio",
      created_by: dani.id,
    });
    if (error) throw error;
    await admin
      .from("profiles")
      .update({ whatsapp_phone: phone })
      .eq("id", dani.id);
  });

  afterAll(async () => {
    await admin.from("whatsapp_messages").delete().eq("from_phone", phone);
    await deleteTestUsers([dani].filter(Boolean));
  });

  it("áudio vira pendente whatsapp_audio, mostra o que ouviu e conta os segundos", async () => {
    transcribeAudio.mockResolvedValueOnce(heard("300 reais pro pedreiro."));
    extractExpense.mockResolvedValueOnce(read());
    await voice();

    expect(extractExpense).toHaveBeenLastCalledWith(
      "300 reais pro pedreiro.",
      expect.anything(),
    );
    const list = last();
    expect(list?.type).toBe("list");
    expect(list?.body).toMatch(
      /^🎤 _"300 reais pro pedreiro\."_\n\n\*R\$ 300,00\* · Mão de obra/,
    );
    expect(await latestExpense()).toMatchObject({
      status: "pending",
      source: "whatsapp_audio",
      raw_input: "300 reais pro pedreiro.",
    });

    await tap(optionId("Alvenaria"));
    expect(last()?.body).toContain("Lançado");
    expect(await latestExpense()).toMatchObject({
      status: "confirmed",
      source: "whatsapp_audio",
    });
    expect(await usage()).toMatchObject({
      ai_calls: 1,
      audio_seconds: 10,
      whatsapp_entries: 1,
    });
  });

  it("sem valor, pergunta o valor; o valor falado completa o gasto do áudio", async () => {
    transcribeAudio.mockResolvedValueOnce(heard("Carrada de areia.", 12));
    extractExpense.mockResolvedValueOnce(
      read({
        amountCents: null,
        description: "Carrada de areia",
        categoryCode: "material",
        missing: ["amount"],
      }),
    );
    await voice();
    expect(last()?.body).toBe(
      '🎤 _"Carrada de areia."_\n\nQual foi o valor de _Carrada de areia_? Mande só o número. Exemplo: 300 ou 1.250,50',
    );

    const calls = extractExpense.mock.calls.length;
    transcribeAudio.mockResolvedValueOnce(heard("450 reais."));
    await voice();
    // O valor não passa pela IA de novo.
    expect(extractExpense.mock.calls.length).toBe(calls);
    expect(await latestExpense()).toMatchObject({
      status: "pending",
      source: "whatsapp_audio",
      raw_input: "Carrada de areia.",
      amount_cents: 45000,
    });
    await tap(optionId("Sem etapa"));
    expect(last()?.body).toContain("Lançado");
    expect((await usage())?.audio_seconds).toBe(32);
  });

  it("comando falado vira comando, sem a IA do gasto", async () => {
    const calls = extractExpense.mock.calls.length;
    const before = await countExpenses();
    transcribeAudio.mockResolvedValueOnce(heard("Resumo."));
    await voice();
    expect(extractExpense.mock.calls.length).toBe(calls);
    expect(await countExpenses()).toBe(before);
    expect(last()?.body).toContain("Casa do sítio");
  });

  it("áudio mudo responde e fica no log, sem gasto", async () => {
    const before = await countExpenses();
    transcribeAudio.mockResolvedValueOnce({ kind: "empty", seconds: 10 });
    const id = await voice();
    expect(last()?.body).toContain("Não ouvi nada");
    expect(await countExpenses()).toBe(before);
    expect(await logError(id)).toBe("audio_empty");
  });

  it("Groq fora do ar responde e fica no log", async () => {
    transcribeAudio.mockResolvedValueOnce({
      kind: "failed",
      reason: "unavailable",
      seconds: null,
    });
    const id = await voice();
    expect(last()?.body).toContain("Não consegui ouvir áudio agora");
    expect(await logError(id)).toBe("audio_unavailable");
  });

  it("áudio grande demais ou em formato recusado nem vai para a Groq", async () => {
    const calls = transcribeAudio.mock.calls.length;

    const big = await voice("audio/ogg", `grande-${crypto.randomUUID()}`);
    expect(last()?.body).toContain("longo demais");
    expect(await logError(big)).toBe("audio_too_large");

    const downloadsBefore = downloads.length;
    const amr = await voice("audio/amr");
    expect(downloads.length).toBe(downloadsBefore);
    expect(last()?.body).toContain("não consigo ouvir");
    expect(await logError(amr)).toBe("audio_unsupported");

    expect(transcribeAudio.mock.calls.length).toBe(calls);
  });
});
