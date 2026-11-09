import "server-only";

import { headers } from "next/headers";

import { APP_URL } from "@/config/app";

/**
 * Origem da requisição atual (ex.: http://localhost:3000 ou o domínio do
 * preview da Vercel), para montar os links de volta do login.
 */
export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return APP_URL;
}
