import { describe, expect, it } from "vitest";

import {
  isValidCnpj,
  isValidCpf,
  normalizeAccessKey,
  normalizeDocument,
} from "@/lib/documents";

// Números fictícios, só com os dígitos verificadores certos.
const CNPJ = "11222333000181";
const CPF = "52998224725";
const KEY = "26111111222333000181650010000123451000123450";

describe("CNPJ e CPF", () => {
  it("aceita com e sem pontuação", () => {
    expect(isValidCnpj(CNPJ)).toBe(true);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCpf(CPF)).toBe(true);
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });

  it("recusa dígito verificador errado e números repetidos", () => {
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCpf("52998224726")).toBe(false);
    expect(isValidCpf("11111111111")).toBe(false);
  });

  it("normaliza para só os dígitos, ou null", () => {
    expect(normalizeDocument("11.222.333/0001-81")).toBe(CNPJ);
    expect(normalizeDocument("529.982.247-25")).toBe(CPF);
    expect(normalizeDocument("11.222.333/0001-80")).toBeNull();
    expect(normalizeDocument("123")).toBeNull();
    expect(normalizeDocument(null)).toBeNull();
  });
});

describe("chave de acesso da NFC-e", () => {
  it("aceita a chave impressa em blocos de 4", () => {
    const printed = KEY.match(/.{1,4}/g)?.join(" ") ?? "";
    expect(normalizeAccessKey(printed)).toBe(KEY);
  });

  it("recusa dígito lido errado ou tamanho errado", () => {
    const wrongDigit = `${KEY.slice(0, 10)}9${KEY.slice(11)}`;
    expect(normalizeAccessKey(wrongDigit)).toBeNull();
    expect(normalizeAccessKey(KEY.slice(0, 43))).toBeNull();
    expect(normalizeAccessKey(null)).toBeNull();
  });
});
