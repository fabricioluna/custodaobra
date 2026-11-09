import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Testes de isolamento (RLS) contra um Supabase de verdade.
 * - No CI: Supabase local subido no próprio GitHub Actions (variáveis do
 *   `supabase status -o env`).
 * - Na máquina: o projeto dev, lido do .env.local.
 */
export default defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/rls/**/*.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Os arquivos criam e apagam usuários: um de cada vez.
    fileParallelism: false,
  },
}));
