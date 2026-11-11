import type { NextRequest } from "next/server";

import { isCronAuthorized } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { runNotifications } from "@/lib/whatsapp/notifications";

/**
 * Cron diário (vercel.json, 12:00 UTC = 9:00 em Recife): alertas de
 * orçamento das etapas que passaram de 80% ou 100% do previsto e, às
 * segundas (no fuso de cada conta), o resumo da semana anterior. As
 * mensagens saem por modelos aprovados pela Meta e contam no plano.
 */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const summary = await runNotifications(createAdminClient());
    console.info("[cron] avisos do WhatsApp:", summary);
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[cron] falha nos avisos do WhatsApp", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
