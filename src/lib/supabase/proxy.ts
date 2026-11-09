import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import type { Database } from "@/types/database";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Renova a sessão do Supabase a cada requisição (tokens expiram) e devolve a
 * resposta com os cookies atualizados e o id do usuário, se houver.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Não coloque código entre a criação do cliente e getClaims(): é aqui que
  // a sessão é validada e, se preciso, renovada.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  return { response, userId };
}

/** Redireciona mantendo os cookies de sessão que acabaram de ser renovados. */
export function redirectWithCookies(
  url: URL,
  from: NextResponse,
): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
