import type { MetadataRoute } from "next";

import { APP_LOCALE, APP_NAME, APP_TAGLINE } from "@/config/app";
import { BRAND_COLORS } from "@/config/brand";

// Ícones gerados por `npm run icons` (scripts/generate-icons.mjs).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_TAGLINE,
    lang: APP_LOCALE,
    id: "/",
    // Instalado, o app abre direto nas obras (ou no login, se precisar).
    start_url: "/inicio",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND_COLORS.navy,
    theme_color: BRAND_COLORS.navy,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
