import { describe, expect, it } from "vitest";

import {
  centsToInput,
  digitsToCents,
  formatCents,
  formatQuantity,
  isValidAmountCents,
  multiplyCents,
  parseMoneyToCents,
  parseQuantity,
} from "@/lib/money";

describe("formatCents", () => {
  it.each([
    [0, "R$ 0,00"],
    [5, "R$ 0,05"],
    [30000, "R$ 300,00"],
    [150050, "R$ 1.500,50"],
    [123456789, "R$ 1.234.567,89"],
  ])("%i → %s", (cents, text) => {
    expect(formatCents(cents)).toBe(text);
  });

  it("usa espaço comum depois do R$", () => {
    expect(formatCents(100)).toBe("R$ 1,00");
    expect(formatCents(100)).not.toMatch(/ | /);
  });
});

describe("centsToInput", () => {
  it("formata sem o símbolo", () => {
    expect(centsToInput(150050)).toBe("1.500,50");
  });
});

describe("parseMoneyToCents", () => {
  it.each([
    ["300", 30000],
    ["1.500", 150000],
    ["1.500,50", 150050],
    ["1500,5", 150050],
    ["R$ 39,90", 3990],
    ["r$39,90", 3990],
    ["39.90", 3990],
    ["39.9", 3990],
    ["1,5", 150],
    ["0,05", 5],
    ["1.000.000", 100000000],
    [" 78 ", 7800],
    ["78,", 7800],
  ])("%s → %i centavos", (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "1,2,3", "1.50.0", "12,345", "-5", "1.5000", "1..5"])(
    "rejeita %j",
    (input) => {
      expect(parseMoneyToCents(input)).toBeNull();
    },
  );
});

describe("isValidAmountCents", () => {
  it("aceita de 1 centavo até menos de R$ 10 milhões", () => {
    expect(isValidAmountCents(1)).toBe(true);
    expect(isValidAmountCents(999_999_999)).toBe(true);
  });

  it("rejeita zero, negativo, fração e R$ 10 milhões", () => {
    expect(isValidAmountCents(0)).toBe(false);
    expect(isValidAmountCents(-100)).toBe(false);
    expect(isValidAmountCents(1.5)).toBe(false);
    expect(isValidAmountCents(1_000_000_000)).toBe(false);
  });
});

describe("digitsToCents (campo estilo maquininha)", () => {
  it.each([
    ["", 0],
    ["3", 3],
    ["30000", 30000],
    ["R$ 1.500,50", 150050],
    ["000123", 123],
  ])("%j → %i", (digits, cents) => {
    expect(digitsToCents(digits)).toBe(cents);
  });

  it("limita a 11 dígitos", () => {
    expect(digitsToCents("1234567890123")).toBe(12345678901);
  });
});

describe("quantidade × valor unitário", () => {
  it("20 sacos × R$ 39,00 = R$ 780,00", () => {
    expect(multiplyCents(3900, 20)).toBe(78000);
  });

  it("arredonda para o centavo", () => {
    expect(multiplyCents(333, 1.5)).toBe(500);
  });

  it.each([
    ["20", 20],
    ["2,5", 2.5],
    ["1.000", 1000],
    ["0,75", 0.75],
  ])("lê a quantidade %j", (input, quantity) => {
    expect(parseQuantity(input)).toBe(quantity);
  });

  it.each(["", "0", "abc", "-2"])("rejeita a quantidade %j", (input) => {
    expect(parseQuantity(input)).toBeNull();
  });

  it("formata a quantidade em pt-BR", () => {
    expect(formatQuantity(2.5)).toBe("2,5");
    expect(formatQuantity(1000)).toBe("1.000");
  });
});
