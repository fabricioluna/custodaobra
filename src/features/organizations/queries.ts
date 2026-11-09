import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Organização pelo endereço (slug). O RLS só devolve se o usuário for membro,
 * então `null` significa "não existe ou não é sua": as duas viram 404.
 */
export const getOrgBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id, name, slug, kind")
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

/**
 * Use no começo de TODA página da área /o/[orgSlug] que busca dados.
 * O layout também checa, mas no Next.js layout e página rodam em paralelo:
 * a checagem do layout não impede o código da página de rodar. A barreira
 * final continua sendo o RLS.
 */
export async function requireOrg(slug: string) {
  const org = await getOrgBySlug(slug);
  if (!org) notFound();
  return org;
}

/** Dados do primeiro acesso: nome da pessoa e da organização pessoal. */
export async function getOnboardingData(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "full_name, onboarded_at, default_org:organizations!profiles_default_org_id_fkey(id, name, slug)",
    )
    .eq("id", userId)
    .maybeSingle();
  return data;
}
