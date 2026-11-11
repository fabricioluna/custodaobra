import "server-only";

import { z } from "zod";

/**
 * Transcrição de áudio do WhatsApp com o Whisper da Groq (CLAUDE.md, seção 7),
 * por `fetch`, sem SDK. Não gasta tokens do Claude: o texto transcrito segue
 * o mesmo caminho de uma mensagem escrita.
 *
 * Preço conferido em novembro de 2026: US$ 0,04 por hora de áudio, com
 * mínimo de 10 segundos cobrados por arquivo.
 */

const ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
export const TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";
/** A Groq cobra pelo menos isto por arquivo. */
export const MIN_BILLED_SECONDS = 10;
/** Voz do WhatsApp (Opus) tem uns 2 KB por segundo: ~15 minutos. */
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
/** Áudios longos viram texto longo; a IA de extração não precisa de mais. */
const MAX_TEXT_LENGTH = 2000;

/**
 * Vocabulário de obra para o Whisper acertar a grafia (o `prompt` só orienta
 * o estilo e as palavras; não é instrução).
 */
const VOCABULARY_PROMPT =
  "Gastos da obra: 300 reais pro pedreiro, diária do servente, 2 sacos de cimento, milheiro de tijolo, carrada de areia, empreita, brita, ferro, pix.";

/** Formatos que o WhatsApp manda e a Groq aceita, com a extensão do arquivo. */
const AUDIO_TYPES: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/flac": "flac",
};

/** Extensão do arquivo para um tipo aceito (sem "; codecs=opus"), ou null. */
export function audioExtension(mimeType: string): string | null {
  const type = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return AUDIO_TYPES[type] ?? null;
}

/** Segundos cobrados pela Groq por um áudio desta duração. */
export function billedSeconds(duration: number | null): number {
  if (duration === null || !Number.isFinite(duration) || duration <= 0) {
    return MIN_BILLED_SECONDS;
  }
  return Math.max(MIN_BILLED_SECONDS, Math.ceil(duration));
}

export type TranscriptionFailure = "not_configured" | "unavailable" | "invalid";

export type TranscriptionResult =
  | { kind: "text"; text: string; seconds: number }
  /** Silêncio, ruído ou só o que o Whisper costuma inventar sem fala. */
  | { kind: "empty"; seconds: number }
  /** `seconds` só quando a Groq chegou a processar (e cobrar) o áudio. */
  | { kind: "failed"; reason: TranscriptionFailure; seconds: number | null };

const responseSchema = z.object({
  text: z.string(),
  duration: z.number().optional(),
  segments: z
    .array(z.object({ no_speech_prob: z.number().optional() }).loose())
    .optional(),
});

/**
 * Frases que o Whisper escreve em áudio mudo ou só com ruído (vêm de
 * legendas de vídeo usadas no treino). Comparadas sem acento e pontuação.
 */
const HALLUCINATIONS = [
  "obrigado",
  "obrigada",
  "obrigado por assistir",
  "obrigada por assistir",
  "tchau tchau",
  "legendas pela comunidade amara org",
  "legenda adriana zanotto",
  "inscreva se no canal",
  "e ai",
  "musica",
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto que não é fala de verdade (vazio ou alucinação conhecida). */
export function isNoSpeech(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return true;
  if (HALLUCINATIONS.includes(normalized)) return true;
  return /amara org|legendas? (pela|por)|inscreva se/.test(normalized);
}

export async function transcribeAudio(
  data: ArrayBuffer,
  mimeType: string,
): Promise<TranscriptionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey)
    return { kind: "failed", reason: "not_configured", seconds: null };
  const extension = audioExtension(mimeType);
  if (!extension) return { kind: "failed", reason: "invalid", seconds: null };

  const form = new FormData();
  form.append(
    "file",
    new Blob([data], { type: mimeType.split(";")[0] }),
    `audio.${extension}`,
  );
  form.append("model", TRANSCRIPTION_MODEL);
  form.append("language", "pt");
  form.append("temperature", "0");
  form.append("response_format", "verbose_json");
  form.append("prompt", VOCABULARY_PROMPT);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[ia] transcrição sem resposta", errorMessage(error));
    return { kind: "failed", reason: "unavailable", seconds: null };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(
      "[ia] transcrição recusada",
      response.status,
      detail.slice(0, 300),
    );
    // 400/413/415: o arquivo; o resto (chave, limite, fora do ar) é do serviço.
    const invalid = [400, 413, 415, 422].includes(response.status);
    return {
      kind: "failed",
      reason: invalid ? "invalid" : "unavailable",
      seconds: null,
    };
  }

  const parsed = responseSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsed.success) {
    return { kind: "failed", reason: "invalid", seconds: MIN_BILLED_SECONDS };
  }
  const { text, duration, segments } = parsed.data;
  const seconds = billedSeconds(duration ?? null);

  // Todos os trechos com cara de silêncio: não há fala, seja o que for o texto.
  const silent =
    !!segments?.length &&
    segments.every((segment) => (segment.no_speech_prob ?? 0) > 0.8);
  const clean = text.replace(/\s+/g, " ").trim();
  if (silent || isNoSpeech(clean)) return { kind: "empty", seconds };
  return { kind: "text", text: clean.slice(0, MAX_TEXT_LENGTH), seconds };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
