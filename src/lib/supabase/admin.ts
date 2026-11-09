import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { getSupabaseUrl } from "./env";

/**
 * Cliente com a chave secreta: IGNORA o RLS.
 * Use só onde não há sessão de usuário (webhook do WhatsApp, cron) e filtre
 * sempre por org_id explicitamente. Nunca importe em código de navegador.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey) {
    throw new Error(
      "Variável de ambiente SUPABASE_SERVICE_ROLE_KEY não definida.",
    );
  }
  return createClient<Database>(getSupabaseUrl(), secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
