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

describe("CNPJ alfanumérico", () => {
  // Exemplo da Receita Federal: 12.ABC.345/01DE-35.
  const ALNUM = "12ABC34501DE35";

  it("aceita com e sem pontuação, em maiúsculas ou minúsculas", () => {
    expect(isValidCnpj(ALNUM)).toBe(true);
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(normalizeDocument("12.abc.345/01de-35")).toBe(ALNUM);
  });

  it("tira o rótulo que vem junto", () => {
    expect(normalizeDocument("CNPJ: 12.ABC.345/01DE-35")).toBe(ALNUM);
    expect(normalizeDocument("CNPJ 11.222.333/0001-81")).toBe(CNPJ);
    expect(normalizeDocument("CPF: 529.982.247-25")).toBe(CPF);
  });

  it("recusa verificador errado, letra no verificador e letra no CPF", () => {
    expect(isValidCnpj("12ABC34501DE36")).toBe(false);
    expect(isValidCnpj("12ABC34501DF35")).toBe(false);
    expect(isValidCnpj("12ABC34501DE3A")).toBe(false);
    expect(normalizeDocument("5299822472A")).toBeNull();
  });
});

describe("chave de acesso da NFC-e", () => {
  it("aceita a chave com CNPJ alfanumérico", () => {
    const key = "26111112ABC34501DE35650010000123451000123451";
    expect(normalizeAccessKey(key)).toBe(key);
    expect(normalizeAccessKey(key.toLowerCase())).toBe(key);
    expect(normalizeAccessKey(`${key.slice(0, 43)}2`)).toBeNull();
    // Letra fora da parte do CNPJ não vale.
    expect(normalizeAccessKey(`A${key.slice(1)}`)).toBeNull();
  });

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
