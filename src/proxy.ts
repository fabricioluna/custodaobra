import type { NextRequest } from "next/server";

import {
  AFTER_LOGIN_PATH,
  isProtectedPath,
  LOGIN_PATH,
  loginPathFor,
} from "@/lib/auth/paths";
import { redirectWithCookies, updateSession } from "@/lib/supabase/proxy";

/**
 * Roda antes de cada página: renova a sessão e faz a checagem otimista de
 * login. A checagem definitiva fica no servidor (RLS e src/lib/auth/session.ts).
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!userId && isProtectedPath(pathname)) {
    const target = new URL(loginPathFor(pathname + search), request.url);
    return redirectWithCookies(target, response);
  }

  // Logado não precisa ver o login, exceto quando ele traz um erro para mostrar
  // (evita ir e voltar entre /entrar e /inicio).
  if (
    userId &&
    pathname === LOGIN_PATH &&
    !request.nextUrl.searchParams.has("erro")
  ) {
    return redirectWithCookies(
      new URL(AFTER_LOGIN_PATH, request.url),
      response,
    );
  }

  return response;
}

export const config = {
  matcher: [
    // Tudo, menos arquivos estáticos, imagens e ícones.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|brand/|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
