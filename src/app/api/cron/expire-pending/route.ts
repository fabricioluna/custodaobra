import type { NextRequest } from "next/server";

import { isCronAuthorized } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { purgeCancelledReceipts } from "@/lib/whatsapp/receipts";

/**
 * Cron diário (vercel.json): lançamentos pendentes com mais de 24 h viram
 * cancelados e as conversas que esperavam por eles voltam ao começo. Depois,
 * os comprovantes dos gastos do WhatsApp cancelados saem do bucket.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("expire_pending_expenses");
  if (error) {
    console.error("[cron] falha ao cancelar pendentes", error.message);
    return Response.json({ ok: false }, { status: 500 });
  }
  console.info("[cron] pendentes cancelados:", data);

  let receipts: number;
  try {
    receipts = await purgeCancelledReceipts(admin);
  } catch (purgeError) {
    console.error("[cron] falha ao apagar comprovantes", purgeError);
    return Response.json({ ok: false, cancelled: data }, { status: 500 });
  }
  console.info("[cron] comprovantes apagados:", receipts);
  return Response.json({ ok: true, cancelled: data, receipts });
}
