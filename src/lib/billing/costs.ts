/**
 * Preços dos serviços pagos por uso, para estimar o custo de cada conta no
 * painel interno. Em dólar. Conferir nas páginas oficiais ao mudar de modelo.
 * - Claude Haiku 5.5: US$ 0,10 por milhão de tokens de entrada e US$ 0,50 de
 *   saída (pedidos de até 100 mil tokens; tabela da Anthropic, nov/2026).
 * - Whisper large-v3-turbo na Groq: cerca de US$ 0,04 por hora de áudio.
 * - Mensagens por modelo da Meta: o preço depende da categoria e do país e
 *   ainda não entra na conta (o painel mostra só a quantidade).
 */
export const AI_INPUT_USD_PER_MTOK = 0.1;
export const AI_OUTPUT_USD_PER_MTOK = 0.5;
export const AUDIO_USD_PER_HOUR = 0.04;

export function estimateAiCostUsd(usage: {
  ai_input_tokens: number;
  ai_output_tokens: number;
  audio_seconds: number;
}): number {
  return (
    (usage.ai_input_tokens / 1_000_000) * AI_INPUT_USD_PER_MTOK +
    (usage.ai_output_tokens / 1_000_000) * AI_OUTPUT_USD_PER_MTOK +
    (usage.audio_seconds / 3600) * AUDIO_USD_PER_HOUR
  );
}
