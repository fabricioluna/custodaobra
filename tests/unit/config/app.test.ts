import { describe, expect, it } from "vitest";

import { APP_DOMAIN, APP_NAME, APP_TAGLINE, APP_URL } from "@/config/app";

describe("config/app", () => {
  it("define nome, domínio e slogan", () => {
    expect(APP_NAME).toBe("Valor da Obra");
    expect(APP_TAGLINE.length).toBeGreaterThan(0);
  });

  it("guarda o domínio sem protocolo nem barra", () => {
    expect(APP_DOMAIN).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
  });

  it("monta uma URL absoluta válida", () => {
    expect(() => new URL(APP_URL)).not.toThrow();
  });
});
