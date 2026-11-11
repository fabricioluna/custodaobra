import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { anthropic, extractionModel } from "./client";
import type { ExtractionContext } from "./extract-expense";
import {
  ANSWER_QUESTION_PROMPT_VERSION,
  ANSWER_QUESTION_SYSTEM,
} from "./prompts/answer-question.v1";
import {
  buildQuestionMessage,
  interpretToolCalls,
  type QueryCall,
  QUERY_TOOLS,
} from "./query-tools";
import type { AiFailureReason, AiUsage } from "./structured";

export { ANSWER_QUESTION_PROMPT_VERSION };

/**
 * Perguntas livres ("quanto gastei com cimento em outubro?"). A IA escolhe
 * as funções de consulta predefinidas e os parâmetros (tool use); ela nunca
 * escreve SQL nem a resposta. Quem consulta o banco e escreve a resposta é o
 * código (src/lib/whatsapp/queries.ts e question-format.ts).
 *
 * Uma chamada só, sem devolver o resultado à IA: os números da resposta vêm
 * direto do banco.
 */

export type QuestionResult =
  | { kind: "queries"; calls: QueryCall[]; usage: AiUsage }
  /** Não é sobre os gastos da obra: o bot explica o que dá para perguntar. */
  | { kind: "off_topic"; usage: AiUsage }
  | { kind: "failed"; reason: AiFailureReason; usage: AiUsage | null };

/**
 * Chama a IA. Não conta uso nem checa limite: isso é de quem chama, que sabe
 * de qual organização é a mensagem.
 */
export async function chooseQueries(
  text: string,
  context: ExtractionContext,
): Promise<QuestionResult> {
  let response: Anthropic.Message;
  try {
    response = await anthropic().messages.create({
      model: extractionModel(),
      // Espaço para o raciocínio (o Haiku pensa por padrão) e as chamadas.
      max_tokens: 2048,
      system: ANSWER_QUESTION_SYSTEM,
      tools: QUERY_TOOLS,
      // Forçar ferramenta não vale nos modelos novos; "fora" também é resposta.
      tool_choice: { type: "auto" },
      output_config: { effort: "low" },
      messages: [
        { role: "user", content: buildQuestionMessage(text, context) },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error("[ia] falha (pergunta)", error.status, error.message);
      return { kind: "failed", reason: "unavailable", usage: null };
    }
    throw error;
  }

  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
  if (response.stop_reason === "refusal") {
    return { kind: "failed", reason: "refused", usage };
  }
  if (response.stop_reason === "max_tokens") {
    return { kind: "failed", reason: "truncated", usage };
  }

  const blocks = response.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!blocks.length) return { kind: "off_topic", usage };

  const calls = interpretToolCalls(blocks, context);
  // Chamou função, mas nenhuma passou na conferência: perguntar de novo.
  if (!calls.length) return { kind: "failed", reason: "invalid_output", usage };
  return { kind: "queries", calls, usage };
}
