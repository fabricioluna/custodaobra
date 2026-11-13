import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { getUserId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/features/members/queries";

/**
 * Papéis já lidos nesta requisição, por organização. `getOrgContext` grava
 * aqui e `getOrgRole` (features/members) lê antes de ir ao banco: a conta e o
 * papel saem de uma consulta só. Fora de uma renderização (rotas de API,
 * algumas ações) o `cache` não guarda nada: `getOrgRole` só faz a própria
 * consulta, como antes.
 */
export const knownOrgRoles = cache(() => new Map<string, OrgRole>());

/**
 * Organização pelo endereço (slug) e o papel da pessoa logada nela, numa
 * consulta só (pelo vínculo em organization_members). A organização só é
 * visível a quem é membro (RLS), então dá no mesmo que ler `organizations`.
 * `null` = não existe ou não é sua: as duas viram 404.
 */
export const getOrgContext = cache(async (slug: string) => {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("role, org:organizations!inner(id, name, slug, kind, timezone)")
    .eq("user_id", userId)
    .eq("org.slug", slug)
    .maybeSingle();
  if (!data?.org) return null;
  knownOrgRoles().set(data.org.id, data.role);
  return { org: data.org, role: data.role };
});

/** Organização pelo endereço (slug); `null` = não existe ou não é sua. */
export const getOrgBySlug = cache(
  async (slug: string) => (await getOrgContext(slug))?.org ?? null,
);

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
