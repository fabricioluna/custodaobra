import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Cliente da API da Anthropic, criado só na hora do uso (o build e o CI
 * rodam sem a chave). Modelos vêm do ambiente, com padrão no Haiku mais
 * recente para extração de texto (rápido e barato).
 */

export const DEFAULT_EXTRACTION_MODEL = "claude-haiku-5-5";

export function extractionModel(): string {
  return process.env.ANTHROPIC_MODEL_EXTRACTION || DEFAULT_EXTRACTION_MODEL;
}

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Variável de ambiente ANTHROPIC_API_KEY não definida.");
  }
  client ??= new Anthropic({
    // Lançar um gasto tem que ser rápido: melhor perguntar de novo à pessoa
    // do que deixá-la esperando.
    timeout: 20_000,
    maxRetries: 1,
  });
  return client;
}
