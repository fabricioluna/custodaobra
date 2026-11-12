import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database";

import {
  type AsaasEvent,
  eventSubscriptionId,
  subscriptionPatch,
} from "./asaas-events";

type Admin = SupabaseClient<Database>;

/** Confere o cabeçalho `asaas-access-token` com `ASAAS_WEBHOOK_TOKEN`. */
export function isAsaasWebhookAuthorized(
  received: string | null,
  expected: string | undefined = process.env.ASAAS_WEBHOOK_TOKEN,
): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type WebhookOutcome =
  "duplicate" | "ignored" | "unknown_subscription" | "updated";

/**
 * Processa um evento do Asaas com o cliente do servidor (sem sessão): grava
 * o evento antes (o mesmo id não roda duas vezes), acha a conta pela
 * assinatura e aplica a mudança filtrando por ela. Se algo falha, o evento
 * fica sem `processed_at` e o Asaas tenta de novo.
 */
export async function processAsaasEvent(
  admin: Admin,
  event: AsaasEvent,
  payload: Json,
  now: Date = new Date(),
): Promise<WebhookOutcome> {
  const { error: insertError } = await admin
    .from("billing_events")
    .upsert(
      { id: event.id, provider: "asaas", event: event.event, payload },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (insertError) throw insertError;
  const { data: stored, error: readError } = await admin
    .from("billing_events")
    .select("processed_at")
    .eq("id", event.id)
    .single();
  if (readError) throw readError;
  if (stored.processed_at) return "duplicate";

  const finish = async (
    outcome: WebhookOutcome,
    orgId: string | null = null,
  ) => {
    const { error } = await admin
      .from("billing_events")
      .update({
        processed_at: now.toISOString(),
        org_id: orgId,
        error: outcome === "unknown_subscription" ? outcome : null,
      })
      .eq("id", event.id);
    if (error) throw error;
    return outcome;
  };

  const subscriptionId = eventSubscriptionId(event);
  if (!subscriptionId) return finish("ignored");

  const { data: row, error: rowError } = await admin
    .from("subscriptions")
    .select(
      "org_id, status, plan_code, provider_plan_code, provider_subscription_id",
    )
    .eq("provider", "asaas")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();
  if (rowError) throw rowError;
  if (!row) return finish("unknown_subscription");

  const patch = subscriptionPatch(event, row, now);
  if (!patch) return finish("ignored", row.org_id);

  const { error: updateError } = await admin
    .from("subscriptions")
    .update(patch)
    .eq("org_id", row.org_id)
    .eq("provider_subscription_id", subscriptionId);
  if (updateError) throw updateError;
  return finish("updated", row.org_id);
}
