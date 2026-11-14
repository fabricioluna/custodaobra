import { describe, expect, it } from "vitest";

import { isProtectedPath, loginPathFor, safeNextPath } from "@/lib/auth/paths";

describe("isProtectedPath", () => {
  it.each([
    "/o/minha-casa/obras",
    "/o",
    "/inicio",
    "/primeiro-acesso",
    "/nova-senha",
  ])("%s exige login", (path) => {
    expect(isProtectedPath(path)).toBe(true);
  });

  it.each(["/", "/entrar", "/auth/callback", "/obras", "/inicio-rapido"])(
    "%s é público",
    (path) => {
      expect(isProtectedPath(path)).toBe(false);
    },
  );
});

describe("safeNextPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeNextPath("/o/minha-casa/contas")).toBe("/o/minha-casa/contas");
    expect(safeNextPath("%2Fo%2Fminha-casa%2Fobras")).toBe(
      "/o/minha-casa/obras",
    );
  });

  it.each([
    ["vazio", ""],
    ["nulo", null],
    ["outro site", "https://golpe.com"],
    ["protocolo relativo", "//golpe.com"],
    ["barra invertida", "/\\golpe.com"],
    ["codificado", "%2F%2Fgolpe.com"],
    ["sem barra", "o/minha-casa"],
    ["javascript", "javascript:alert(1)"],
    ["quebra de linha", "/o/x%0D%0ALocation:%20https://golpe.com"],
    ["volta ao login", "/entrar"],
    ["codificação inválida", "%E0%A4%A"],
  ])("rejeita %s e manda para /inicio", (_, value) => {
    expect(safeNextPath(value)).toBe("/inicio");
  });
});

describe("loginPathFor", () => {
  it("guarda o destino para depois do login", () => {
    expect(loginPathFor("/o/minha-casa/contas?mes=10")).toBe(
      "/entrar?next=%2Fo%2Fminha-casa%2Fcontas%3Fmes%3D10",
    );
  });

  it("não precisa de next quando o destino é o padrão", () => {
    expect(loginPathFor("/inicio")).toBe("/entrar");
  });
});
