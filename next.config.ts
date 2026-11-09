import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // O "N" do Next.js (só em desenvolvimento) ficava em cima da navegação
  // inferior. Erros continuam aparecendo na tela normalmente.
  devIndicators: false,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // Foto do comprovante vai junto com o formulário do gasto. As fotos são
      // reduzidas no aparelho; o teto real é o da Vercel (4,5 MB por requisição).
      bodySizeLimit: "4.5mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
