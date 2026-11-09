"use client";

import { useEffect } from "react";

/** Registra o service worker (tela de "sem conexão"). Só em produção. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Sem service worker o app funciona igual; só perde a tela offline.
      });
  }, []);
  return null;
}
