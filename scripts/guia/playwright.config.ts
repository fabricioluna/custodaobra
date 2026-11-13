import { defineConfig, devices } from "@playwright/test";

/**
 * Fotos das telas para o guia do usuário, no build de produção (rode
 * `npm run build` antes), contra o Supabase do .env.local:
 *   npx playwright test --config scripts/guia/playwright.config.ts
 * Depois: node scripts/guia/build-pdf.mjs
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sem .env.local não há o que fotografar.
}

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: "capturas.spec.ts",
  workers: 1,
  reporter: "list",
  timeout: 15 * 60_000,
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Recife",
  },
  projects: [
    {
      name: "celular",
      use: {
        ...devices["Pixel 7"],
        // Botão de arquivo e campo de data em português: o Chromium
        // completo (não o headless-shell) respeita o --lang.
        channel: "chromium",
        launchOptions: { args: ["--lang=pt-BR"] },
      },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
