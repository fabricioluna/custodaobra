import { describe, expect, it } from "vitest";

import {
  formatPhone,
  normalizePhone,
  phoneVariants,
  samePhone,
} from "@/lib/whatsapp/phone";

describe("normalizePhone", () => {
  it("deixa só os dígitos", () => {
    expect(normalizePhone("+55 (81) 99999-8888")).toBe("5581999998888");
    expect(normalizePhone("")).toBe("");
  });
});

describe("phoneVariants (nono dígito)", () => {
  it("celular com 9: também sem o 9", () => {
    expect(phoneVariants("5581999998888")).toEqual([
      "5581999998888",
      "558199998888",
    ]);
  });

  it("celular antigo sem 9: também com o 9", () => {
    expect(phoneVariants("558188887777")).toEqual([
      "558188887777",
      "5581988887777",
    ]);
  });

  it("fixo não ganha variante", () => {
    expect(phoneVariants("558133334444")).toEqual(["558133334444"]);
  });

  it("número de outro país não ganha variante", () => {
    expect(phoneVariants("14155550123")).toEqual(["14155550123"]);
  });

  it("aceita o número formatado", () => {
    expect(phoneVariants("+55 81 99999-8888")).toContain("558199998888");
  });

  it("vazio não tem variante", () => {
    expect(phoneVariants("")).toEqual([]);
  });
});

describe("samePhone", () => {
  it("considera iguais com e sem o nono dígito", () => {
    expect(samePhone("5581999998888", "558199998888")).toBe(true);
    expect(samePhone("558199998888", "+55 81 99999-8888")).toBe(true);
  });

  it("números diferentes não batem", () => {
    expect(samePhone("5581999998888", "5581999997777")).toBe(false);
    expect(samePhone("5581999998888", "")).toBe(false);
  });
});

describe("formatPhone", () => {
  it("formata celular e fixo brasileiros", () => {
    expect(formatPhone("5581999998888")).toBe("+55 (81) 99999-8888");
    expect(formatPhone("558133334444")).toBe("+55 (81) 3333-4444");
  });

  it("outros países ficam com + e os dígitos", () => {
    expect(formatPhone("14155550123")).toBe("+14155550123");
  });
});
