import "server-only";

import {
  audioExtension,
  MAX_AUDIO_BYTES,
  transcribeAudio,
} from "@/lib/ai/transcribe-audio";
import { recordUsage } from "@/lib/billing/usage";
import { todayIn } from "@/lib/dates";

import { downloadMedia, MediaTooLargeError } from "../client";
import { parseCommand } from "../commands";
import { botMessages } from "../messages";
import { handleCommand } from "./commands";
import { type BotSession, checkAiAllowed, handleText } from "./expense";

export type AudioMedia = { id: string; mimeType: string };

/**
 * Áudio (mensagem de voz ou arquivo): baixa da Meta, transcreve com a Groq e
 * segue como se a pessoa tivesse escrito o texto. Comando falado ("resumo")
 * vira comando; o resto vai para a leitura do gasto, com a transcrição em
 * `raw_input` e `source = whatsapp_audio`.
 *
 * Os segundos transcritos contam no uso da conta ativa (ou da conta padrão
 * da pessoa), que também passa pelo limite do plano antes de gastar.
 */
export async function handleAudio(
  session: BotSession,
  media: AudioMedia,
  logId: string | null,
  defaultOrgId: string | null,
): Promise<void> {
  const fail = (code: string, body: string) => {
    session.noteError?.(code);
    return session.send({ type: "text", body });
  };

  if (!audioExtension(media.mimeType)) {
    return fail("audio_unsupported", botMessages.audioUnsupported);
  }
  const orgId = session.conversation.active_org_id ?? defaultOrgId;
  if (!orgId)
    return session.send({ type: "text", body: botMessages.noProjects });
  const today = todayIn();

  // Limite e download ao mesmo tempo: são independentes.
  const [allowed, download] = await Promise.all([
    checkAiAllowed(session, orgId, today),
    downloadMedia(media.id, MAX_AUDIO_BYTES).then(
      (file) => ({ ok: true as const, file }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
  ]);
  if (!allowed) return;
  if (!download.ok) {
    if (download.error instanceof MediaTooLargeError) {
      return fail("audio_too_large", botMessages.audioTooLarge);
    }
    console.error("[whatsapp] falha ao baixar o áudio", download.error);
    return fail("audio_download_failed", botMessages.audioDownloadFailed);
  }
  const { file } = download;
  // O tipo que a Meta informa no download vale mais que o da mensagem.
  const mimeType = audioExtension(file.mimeType)
    ? file.mimeType
    : media.mimeType;

  const result = await transcribeAudio(file.data, mimeType);
  const usage =
    result.seconds !== null
      ? recordUsage(session.admin, orgId, today, {
          audioSeconds: result.seconds,
        })
      : Promise.resolve();

  if (result.kind === "failed") {
    await usage;
    return fail(
      `audio_${result.reason}`,
      result.reason === "invalid"
        ? botMessages.audioUnsupported
        : botMessages.audioUnavailable,
    );
  }
  if (result.kind === "empty") {
    await usage;
    return fail("audio_empty", botMessages.audioEmpty);
  }

  const command = parseCommand(result.text);
  await Promise.all([
    usage,
    command
      ? handleCommand(session, command)
      : handleText(session, result.text, logId, "whatsapp_audio"),
  ]);
}
