import type { NextRequest } from "next/server";

import { isCronAuthorized } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cron diário (vercel.json): lançamentos pendentes com mais de 24 h viram
 * cancelados e as conversas que esperavam por eles voltam ao começo.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { data, error } = await createAdminClient().rpc(
    "expire_pending_expenses",
  );
  if (error) {
    console.error("[cron] falha ao cancelar pendentes", error.message);
    return Response.json({ ok: false }, { status: 500 });
  }
  console.info("[cron] pendentes cancelados:", data);
  return Response.json({ ok: true, cancelled: data });
}
