import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";

import { APP_LOCALE, APP_NAME, APP_TAGLINE, APP_URL } from "@/config/app";
import { BRAND_COLORS } from "@/config/brand";

import "./globals.css";

// Archivo: grotesca de largura variável. Corpo na largura normal; títulos na
// versão larga e pesada (utilitário `heading` em globals.css), como letra de placa.
const archivo = Archivo({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
};

export const viewport: Viewport = {
  themeColor: BRAND_COLORS.navy,
  // Permite usar a área segura (barra inferior do iPhone) na navegação.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={APP_LOCALE}
      className={`${archivo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
