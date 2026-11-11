import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export type AiUsage = { inputTokens: number; outputTokens: number };

export type AiFailureReason =
  "unavailable" | "invalid_output" | "refused" | "truncated";

export type StructuredResult<T> =
  | { ok: true; data: T; usage: AiUsage }
  /** A IA não respondeu ou respondeu fora do formato: perguntar à pessoa. */
  | { ok: false; reason: AiFailureReason; usage: AiUsage | null };

/**
 * Uma chamada com saída estruturada (structured outputs, esquema Zod),
 * validada de novo com o Zod. Não conta uso nem checa limite: isso é de quem
 * chama, que sabe de qual organização é a mensagem.
 */
export async function parseStructured<S extends z.ZodType>(
  client: Anthropic,
  params: {
    model: string;
    system: string;
    content: string | Anthropic.ContentBlockParam[];
    schema: S;
    maxTokens: number;
    label: string;
    /** Tempo e tentativas desta chamada, se diferentes do padrão do cliente. */
    request?: { timeout: number; maxRetries: number };
  },
): Promise<StructuredResult<z.infer<S>>> {
  let response;
  try {
    response = await client.messages.parse(
      {
        model: params.model,
        max_tokens: params.maxTokens,
        system: params.system,
        messages: [{ role: "user", content: params.content }],
        output_config: {
          effort: "low",
          format: zodOutputFormat(params.schema),
        },
      },
      params.request,
    );
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[ia] falha (${params.label})`,
        error.status,
        error.message,
      );
      return { ok: false, reason: "unavailable", usage: null };
    }
    // Saída que não bate com o esquema também cai aqui.
    console.error(`[ia] saída inválida (${params.label})`, error);
    return { ok: false, reason: "invalid_output", usage: null };
  }

  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
  if (response.stop_reason === "refusal") {
    return { ok: false, reason: "refused", usage };
  }
  if (response.stop_reason === "max_tokens") {
    return { ok: false, reason: "truncated", usage };
  }
  const parsed = params.schema.safeParse(response.parsed_output);
  if (!parsed.success) return { ok: false, reason: "invalid_output", usage };
  return { ok: true, data: parsed.data as z.infer<S>, usage };
}
