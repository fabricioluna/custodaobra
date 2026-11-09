import { type NextRequest, NextResponse } from "next/server";

import { orgPath } from "@/components/layout/nav";
import { LOGIN_PATH, ONBOARDING_PATH } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

/**
 * Para onde vai quem acabou de entrar (e quem abre o app instalado): primeiro
 * acesso (escolher o nome da conta), o painel da obra (se só houver uma) ou a
 * lista de obras da organização padrão.
 */
export async function GET(request: NextRequest) {
  const to = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return to(LOGIN_PATH);

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "onboarded_at, default_org:organizations!profiles_default_org_id_fkey(id, slug)",
    )
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return to(`${LOGIN_PATH}?erro=conta`);
  if (!profile.onboarded_at) return to(ONBOARDING_PATH);

  let slug = profile.default_org?.slug;
  let orgId = profile.default_org?.id;
  if (!slug) {
    // Sem organização padrão (ex.: foi removida): usa a primeira em que é membro.
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organizations(id, slug)")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    slug = membership?.organizations?.slug;
    orgId = membership?.organizations?.id;
  }
  if (!slug || !orgId) return to(`${LOGIN_PATH}?erro=conta`);

  // Uma obra só: vai direto para o painel dela (o caso mais comum).
  const { data: projects } = await supabase
    .from("projects")
    .select("id")
    .eq("org_id", orgId)
    .is("archived_at", null)
    .limit(2);
  if (projects?.length === 1) return to(orgPath(slug, "obras", projects[0].id));

  return to(orgPath(slug, "obras"));
}
