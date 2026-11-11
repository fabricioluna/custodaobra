import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  audioExtension,
  billedSeconds,
  isNoSpeech,
  MIN_BILLED_SECONDS,
  transcribeAudio,
} = await import("@/lib/ai/transcribe-audio");
const { heardPrefix } = await import("@/lib/whatsapp/messages");

const audio = new TextEncoder().encode("áudio").buffer;

const groqReply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("audioExtension", () => {
  it("aceita a voz do WhatsApp e formatos comuns", () => {
    expect(audioExtension("audio/ogg; codecs=opus")).toBe("ogg");
    expect(audioExtension("audio/mpeg")).toBe("mp3");
    expect(audioExtension("AUDIO/MP4")).toBe("m4a");
  });

  it("recusa o que a Groq não lê", () => {
    expect(audioExtension("audio/amr")).toBeNull();
    expect(audioExtension("audio/aac")).toBeNull();
    expect(audioExtension("image/jpeg")).toBeNull();
    expect(audioExtension("")).toBeNull();
  });
});

describe("billedSeconds", () => {
  it("cobra no mínimo 10 segundos e arredonda para cima", () => {
    expect(billedSeconds(3.2)).toBe(MIN_BILLED_SECONDS);
    expect(billedSeconds(10)).toBe(10);
    expect(billedSeconds(12.1)).toBe(13);
    expect(billedSeconds(null)).toBe(MIN_BILLED_SECONDS);
    expect(billedSeconds(Number.NaN)).toBe(MIN_BILLED_SECONDS);
  });
});

describe("isNoSpeech", () => {
  it("reconhece o que o Whisper inventa em áudio mudo", () => {
    expect(isNoSpeech("")).toBe(true);
    expect(isNoSpeech("  ")).toBe(true);
    expect(isNoSpeech("Obrigado.")).toBe(true);
    expect(isNoSpeech("Legendas pela comunidade Amara.org")).toBe(true);
    expect(isNoSpeech("Inscreva-se no canal!")).toBe(true);
  });

  it("deixa passar fala de verdade", () => {
    expect(isNoSpeech("300 reais pro pedreiro")).toBe(false);
    expect(isNoSpeech("Obrigado, paguei 50 de frete")).toBe(false);
    expect(isNoSpeech("resumo")).toBe(false);
  });
});

describe("transcribeAudio", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("manda o arquivo com o modelo, o português e o vocabulário", async () => {
    fetchMock.mockResolvedValueOnce(
      groqReply({
        text: " 300 reais pro pedreiro. ",
        duration: 2.4,
        segments: [{ no_speech_prob: 0.01 }],
      }),
    );

    const result = await transcribeAudio(audio, "audio/ogg; codecs=opus");

    expect(result).toEqual({
      kind: "text",
      text: "300 reais pro pedreiro.",
      seconds: MIN_BILLED_SECONDS,
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer gsk_test",
    );
    const form = init?.body as FormData;
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
    expect(form.get("language")).toBe("pt");
    expect(form.get("temperature")).toBe("0");
    expect(form.get("response_format")).toBe("verbose_json");
    expect(form.get("prompt")).toContain("milheiro de tijolo");
    const file = form.get("file") as File;
    expect(file.name).toBe("audio.ogg");
    expect(file.type).toBe("audio/ogg");
  });

  it("conta a duração real de áudios longos", async () => {
    fetchMock.mockResolvedValueOnce(
      groqReply({ text: "dois sacos de cimento", duration: 41.3 }),
    );
    const result = await transcribeAudio(audio, "audio/ogg");
    expect(result).toMatchObject({ kind: "text", seconds: 42 });
  });

  it("áudio mudo ou só com alucinação vira vazio (e é cobrado)", async () => {
    fetchMock.mockResolvedValueOnce(
      groqReply({ text: "Obrigado.", duration: 1.2 }),
    );
    expect(await transcribeAudio(audio, "audio/ogg")).toEqual({
      kind: "empty",
      seconds: MIN_BILLED_SECONDS,
    });

    fetchMock.mockResolvedValueOnce(
      groqReply({
        text: "Tá bom então.",
        duration: 4,
        segments: [{ no_speech_prob: 0.95 }, { no_speech_prob: 0.9 }],
      }),
    );
    expect(await transcribeAudio(audio, "audio/ogg")).toMatchObject({
      kind: "empty",
    });
  });

  it("sem a chave, nem chama a Groq", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    expect(await transcribeAudio(audio, "audio/ogg")).toEqual({
      kind: "failed",
      reason: "not_configured",
      seconds: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("formato recusado não chama a Groq", async () => {
    expect(await transcribeAudio(audio, "audio/amr")).toMatchObject({
      kind: "failed",
      reason: "invalid",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("separa erro do arquivo de serviço fora do ar", async () => {
    fetchMock.mockResolvedValueOnce(groqReply({ error: "bad file" }, 400));
    expect(await transcribeAudio(audio, "audio/ogg")).toMatchObject({
      kind: "failed",
      reason: "invalid",
    });

    fetchMock.mockResolvedValueOnce(groqReply({ error: "rate" }, 429));
    expect(await transcribeAudio(audio, "audio/ogg")).toMatchObject({
      kind: "failed",
      reason: "unavailable",
    });

    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    expect(await transcribeAudio(audio, "audio/ogg")).toEqual({
      kind: "failed",
      reason: "unavailable",
      seconds: null,
    });
  });

  it("resposta fora do formato é falha (cobrada pelo mínimo)", async () => {
    fetchMock.mockResolvedValueOnce(groqReply({ nada: true }));
    expect(await transcribeAudio(audio, "audio/ogg")).toEqual({
      kind: "failed",
      reason: "invalid",
      seconds: MIN_BILLED_SECONDS,
    });
  });
});

describe("heardPrefix", () => {
  it("repete o que foi ouvido em itálico", () => {
    expect(heardPrefix("300 pedreiro")).toBe('🎤 _"300 pedreiro"_\n\n');
  });

  it("corta textos longos e tira o sublinhado que quebraria o itálico", () => {
    const prefix = heardPrefix(`${"a".repeat(300)}`);
    expect(prefix.length).toBeLessThan(215);
    expect(prefix).toContain("…");
    expect(heardPrefix("loja_do_ze")).toContain("loja do ze");
  });
});
