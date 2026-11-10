import type { NextRequest } from "next/server";

import { isCronAuthorized } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cron diário (vercel.json): apaga o conteúdo das mensagens do WhatsApp com
 * mais de 90 dias (fica só o vínculo com o lançamento) e os códigos de
 * vínculo vencidos.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { data, error } = await createAdminClient().rpc("purge_whatsapp_log");
  if (error) {
    console.error("[cron] falha ao limpar o log do WhatsApp", error.message);
    return Response.json({ ok: false }, { status: 500 });
  }
  console.info("[cron] mensagens limpas:", data);
  return Response.json({ ok: true, purged: data });
}
