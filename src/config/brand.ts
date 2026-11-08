/**
 * Cores da marca para usos fora do CSS (metadados, manifest do PWA, e-mails).
 * Nos componentes, use as classes do Tailwind (bg-brand-navy etc.), nunca estes valores.
 * Precisam bater com os tokens de src/app/globals.css (há um teste que confere).
 */
export const BRAND_COLORS = {
  navy: "#1c2a44",
  gold: "#ecb72d",
  white: "#ffffff",
} as const;
