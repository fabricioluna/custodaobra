import "server-only";

import { requireUserId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Número ligado ao perfil de quem está logado (ou nulo). */
export async function getMyWhatsapp(): Promise<{
  phone: string | null;
  linkedAt: string | null;
}> {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("whatsapp_phone, whatsapp_linked_at")
    .eq("id", userId)
    .maybeSingle();
  return {
    phone: data?.whatsapp_phone ?? null,
    linkedAt: data?.whatsapp_linked_at ?? null,
  };
}

/** Número do bot só com dígitos, para o link wa.me (nulo se não configurado). */
export function botNumber(): string | null {
  const digits = (process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER ?? "").replace(
    /\D/g,
    "",
  );
  return digits || null;
}
