import "server-only";

import { chooseQueries } from "@/lib/ai/answer-question";
import { loadExtractionContext } from "@/lib/ai/context";
import type { ExtractionContext } from "@/lib/ai/extract-expense";
import { canAskWhatsappQuestion } from "@/lib/billing/limits";
import { recordUsage } from "@/lib/billing/usage";
import { todayIn } from "@/lib/dates";

import { botMessages } from "../messages";
import type { BotProject } from "../projects";
import { runQuery } from "../queries";
import { formatAnswers } from "../question-format";
import type { BotSession } from "./expense";

/**
 * Perguntas livres ("quanto gastei com cimento em outubro?"). A IA escolhe as
 * funções de consulta predefinidas; o código consulta o banco (filtrando por
 * conta e obra) e escreve a resposta. Não mexe no gasto pendente nem no
 * estado da conversa.
 */
export async function answerQuestion(
  session: BotSession,
  project: BotProject,
  text: string,
  options: {
    /** Contexto já carregado pela leitura do gasto (que também checou o plano). */
    context?: ExtractionContext;
    /** Prefixo do áudio ("🎤 o que foi ouvido"). */
    heard?: string;
  } = {},
): Promise<void> {
  const { admin } = session;
  const heard = options.heard ?? "";
  const today = todayIn(project.timezone);
  const reply = (body: string) =>
    session.send({ type: "text", body: heard + body });

  let context = options.context;
  if (!context) {
    // Veio direto (quem só acompanha): checa o plano e carrega o contexto.
    const [allowed, loaded] = await Promise.all([
      canAskWhatsappQuestion(admin, project.orgId, today),
      loadExtractionContext(admin, project.orgId, project.id, project.timezone),
    ]);
    if (!allowed.ok) {
      session.noteError?.(`limit_${allowed.reason}`);
      return reply(
        allowed.reason === "max_ai_calls"
          ? botMessages.questionLimitReached
          : allowed.reason === "whatsapp_disabled"
            ? botMessages.questionWhatsappDisabled
            : allowed.reason === "subscription_inactive"
              ? botMessages.subscriptionInactive
              : botMessages.questionUnavailable,
      );
    }
    context = loaded;
  }

  const result = await chooseQueries(text, context);
  // Toda chamada conta no plano, mesmo a que falhou (tokens, se vieram).
  const usage = recordUsage(admin, project.orgId, today, {
    aiCalls: 1,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
  });

  if (result.kind === "failed") {
    session.noteError?.(`ai_${result.reason}`);
    await Promise.all([
      usage,
      reply(
        result.reason === "unavailable"
          ? botMessages.questionUnavailable
          : botMessages.questionNotUnderstood,
      ),
    ]);
    return;
  }
  if (result.kind === "off_topic") {
    await Promise.all([
      usage,
      reply(
        project.canLaunch
          ? botMessages.questionHowTo
          : botMessages.viewerQuestionHowTo,
      ),
    ]);
    return;
  }

  let body: string;
  try {
    // As consultas da pergunta ao mesmo tempo, todas na conta e obra ativas.
    const answers = await Promise.all(
      result.calls.map((call) => runQuery(admin, project, call, today)),
    );
    body = formatAnswers(answers, {
      today,
      projectName: project.name,
      stages: context.stages,
    });
  } catch (error) {
    console.error("[whatsapp] falha ao consultar a pergunta", error);
    session.noteError?.("query_failed");
    body = botMessages.questionFailed;
  }
  await Promise.all([usage, reply(body)]);
}
