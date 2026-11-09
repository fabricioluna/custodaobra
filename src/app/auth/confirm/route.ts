import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { LOGIN_PATH, safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

const EMAIL_TYPES: readonly EmailOtpType[] = [
  "email",
  "magiclink",
  "signup",
  "invite",
  "recovery",
  "email_change",
];

/**
 * Link de acesso do e-mail. Aceita dois formatos:
 * - `token_hash`: do nosso modelo (supabase/templates/acesso.html). Funciona
 *   mesmo se a pessoa abrir o e-mail em outro aparelho ou navegador.
 * - `code`: do modelo padrão do Supabase (o único possível sem SMTP próprio).
 *   Só funciona no mesmo navegador em que a pessoa pediu o e-mail.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));
  const success = () => NextResponse.redirect(new URL(next, request.url));

  if (tokenHash && type && EMAIL_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) return success();
  } else if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return success();
  }

  return NextResponse.redirect(new URL(`${LOGIN_PATH}?erro=link`, request.url));
}
