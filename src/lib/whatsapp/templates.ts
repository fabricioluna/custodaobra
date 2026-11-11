import type { OutgoingMessage } from "./client";

/**
 * Modelos de mensagem (templates) do WhatsApp, para os avisos que o bot manda
 * sem a pessoa ter escrito nas últimas 24 h (CLAUDE.md, seção 6). Cada modelo
 * precisa ser cadastrado e aprovado na Meta (WhatsApp Manager > Modelos de
 * mensagem), com o mesmo nome, idioma e texto daqui, na categoria "Utilidade".
 * A Meta cobra cada mensagem enviada; o plano tem um teto por mês.
 *
 * Regras da Meta para o texto: parâmetros ({{1}}, {{2}}…) em sequência, nem
 * no começo nem no fim do texto; o valor de um parâmetro não pode ter quebra
 * de linha, tabulação nem mais de 4 espaços seguidos.
 */

export const TEMPLATE_LANGUAGE = "pt_BR";

export const TEMPLATES = {
  /**
   * Etapa passou de 80% ou de 100% do previsto (gasto + contas a pagar).
   * {{1}} obra · {{2}} etapa · {{3}} percentual · {{4}} usado · {{5}} previsto
   */
  budgetAlert: {
    name: "alerta_orcamento",
    text: "⚠️ Atenção na obra {{1}}: a etapa {{2}} já chegou a {{3}} do previsto ({{4}} de {{5}}, contando as contas a pagar). Veja os detalhes no app.",
    example: ["Casa nova", "Alvenaria", "85%", "R$ 17.000,00", "R$ 20.000,00"],
  },
  /**
   * Resumo da semana anterior (segunda a domingo).
   * {{1}} obra · {{2}} gasto na semana · {{3}} quantos gastos · {{4}} total da
   * construção · {{5}} contas (a vencer e atrasadas)
   */
  weeklyReport: {
    name: "resumo_semanal",
    text: "📋 Resumo da semana da obra {{1}}: {{2}} em gastos ({{3}}). Construção até agora: {{4}}. {{5}} Veja tudo no app.",
    example: [
      "Casa nova",
      "R$ 3.450,00",
      "12 gastos",
      "R$ 84.300,00",
      "Contas nos próximos 7 dias: R$ 1.200,00.",
    ],
  },
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

/** Valor de parâmetro no formato que a Meta aceita (uma linha, curto). */
export function templateParam(value: string): string {
  const text = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, 200);
  // Parâmetro vazio é recusado pela Meta.
  return text || "-";
}

/** Texto final, para o log e o simulador (a Meta monta o dela). */
export function renderTemplate(text: string, params: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (match, index: string) => {
    const value = params[Number(index) - 1];
    return value ?? match;
  });
}

export function templateMessage(
  key: TemplateKey,
  values: string[],
): Extract<OutgoingMessage, { type: "template" }> {
  const template = TEMPLATES[key];
  const params = values.map(templateParam);
  return {
    type: "template",
    name: template.name,
    language: TEMPLATE_LANGUAGE,
    params,
    body: renderTemplate(template.text, params),
  };
}
