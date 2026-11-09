/**
 * Variáveis do Supabase, lidas só na hora do uso (nunca no carregamento do
 * módulo), para o build funcionar sem elas, como no CI.
 * Os nomes NEXT_PUBLIC_ precisam aparecer literais para o Next.js embuti-los
 * no navegador.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não definida. Copie .env.example para .env.local e preencha.`,
    );
  }
  return value;
}

export function getSupabaseUrl(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

/** Chave pública (publishable/anon). Pode ir para o navegador. */
export function getSupabasePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
