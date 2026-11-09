import { type NextRequest, NextResponse } from "next/server";

import { orgPath } from "@/components/layout/nav";
import { LOGIN_PATH, ONBOARDING_PATH } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

/**
 * Para onde vai quem acabou de entrar: primeiro acesso (escolher o nome da
 * conta) ou as obras da organização padrão.
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
      "onboarded_at, default_org:organizations!profiles_default_org_id_fkey(slug)",
    )
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return to(`${LOGIN_PATH}?erro=conta`);
  if (!profile.onboarded_at) return to(ONBOARDING_PATH);

  let slug = profile.default_org?.slug;
  if (!slug) {
    // Sem organização padrão (ex.: foi removida): usa a primeira em que é membro.
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organizations(slug)")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    slug = membership?.organizations?.slug;
  }
  if (!slug) return to(`${LOGIN_PATH}?erro=conta`);

  return to(orgPath(slug, "obras"));
}
