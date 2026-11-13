import type { Metadata, Viewport } from "next";

import { APP_LOCALE, APP_NAME, APP_TAGLINE, APP_URL } from "@/config/app";
import { ServiceWorker } from "@/components/service-worker";
import { BRAND_COLORS } from "@/config/brand";

import { archivo } from "./fonts";

import "./globals.css";

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
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
