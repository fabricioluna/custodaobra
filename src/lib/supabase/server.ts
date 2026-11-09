import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import type { Database } from "@/types/database";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Cliente do Supabase com a sessão do usuário (cookies), para Server
 * Components, Server Actions e Route Handlers. Respeita RLS.
 * Ler cookies é dado da requisição: em páginas, use dentro de <Suspense>.
 */
export async function createClient() {
  // Dados do usuário são sempre da requisição: nunca entram num prerender
  // (nem no prefetch em tempo de execução, que já enxerga os cookies). Sem
  // isto, o supabase-js lê o relógio para validar a sessão durante o
  // prerender, e o Next.js acusa erro.
  await connection();
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
