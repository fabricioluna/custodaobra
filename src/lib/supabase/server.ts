import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Cliente do Supabase com a sessão do usuário (cookies), para Server
 * Components, Server Actions e Route Handlers. Respeita RLS.
 * Ler cookies é dado da requisição: em páginas, use dentro de <Suspense>.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Chamado de um Server Component, onde não dá para gravar cookies.
            // Sem problema: o proxy (src/proxy.ts) renova a sessão a cada acesso.
          }
        },
      },
    },
  );
}
