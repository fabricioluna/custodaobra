import type { NextRequest } from "next/server";

import { asaasEventSchema } from "@/lib/billing/asaas-events";
import {
  isAsaasWebhookAuthorized,
  type JsonObject,
  processAsaasEvent,
} from "@/lib/billing/asaas-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook do Asaas (cobranças e assinaturas). Autenticado pelo token
 * cadastrado no Asaas (`asaas-access-token`). Responde 200 a tudo o que foi
 * gravado, inclusive eventos que não interessam, para a fila do Asaas não
 * pausar; só falha (e o Asaas repete) quando o banco falha.
 */
export async function POST(request: NextRequest) {
  if (!isAsaasWebhookAuthorized(request.headers.get("asaas-access-token"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload: unknown = await request.json().catch(() => null);
  const parsed = asaasEventSchema.safeParse(payload);
  if (!parsed.success) {
    console.error("[cobrança] evento do Asaas fora do formato", parsed.error);
    return Response.json({ ok: true, outcome: "invalid" });
  }

  try {
    const outcome = await processAsaasEvent(
      createAdminClient(),
      parsed.data,
      payload as JsonObject,
    );
    if (outcome === "unknown_subscription") {
      console.error(
        "[cobrança] assinatura do Asaas desconhecida",
        parsed.data.id,
      );
    }
    return Response.json({ ok: true, outcome });
  } catch (error) {
    console.error(
      "[cobrança] falha ao processar evento",
      parsed.data.id,
      error,
    );
    return Response.json({ ok: false }, { status: 500 });
  }
}
