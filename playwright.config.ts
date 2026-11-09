import { defineConfig, devices } from "@playwright/test";

/**
 * Testes ponta a ponta.
 * - Na máquina: sobe `npm run dev` (ou reaproveita o que já estiver rodando) e
 *   usa o projeto Supabase do .env.local. Os usuários de teste são apagados no fim.
 * - No CI: roda o build de produção contra o Supabase local do runner.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sem .env.local (CI): as variáveis já vêm do ambiente.
}

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["list"]] : "list",
  timeout: 60_000,
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Recife",
    trace: "retain-on-failure",
  },
  projects: [
    // O uso real é no celular: o padrão é a tela de um Android comum.
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: isCI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
