import { defineConfig, devices } from "@playwright/test";

/**
 * Medição do tempo das telas, no build de produção (rode `npm run build`
 * antes), contra o Supabase do .env.local. Sobe o `next start` na porta 3200,
 * ou reaproveita um que já esteja nela.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sem .env.local não há o que medir.
}

const PORT = Number(process.env.PERF_PORT ?? 3200);

export default defineConfig({
  testDir: ".",
  testMatch: "medir.spec.ts",
  workers: 1,
  reporter: "list",
  timeout: 20 * 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Recife",
  },
  projects: [{ name: "celular", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
