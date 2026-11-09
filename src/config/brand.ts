/**
 * Cores da marca para usos fora do CSS (metadados, manifest do PWA, ícones, e-mails).
 * Nos componentes, use as classes do Tailwind (bg-brand-navy etc.), nunca estes valores.
 * Precisam bater com os tokens de src/app/globals.css (há um teste que confere).
 *
 * Valores tirados da logo (convertida de Adobe RGB para sRGB).
 */
export const BRAND_COLORS = {
  navy: "#002344",
  gold: "#ffb800",
  white: "#ffffff",
} as const;
