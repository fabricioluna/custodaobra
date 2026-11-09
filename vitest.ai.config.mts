import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Avaliação da IA com a API de verdade (custa dinheiro). Fora do CI: rode à
 * mão com `npm run test:ai` depois de mudar o prompt ou o modelo.
 */
export default defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/ai/**/*.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 60_000,
    maxConcurrency: 5,
  },
}));
