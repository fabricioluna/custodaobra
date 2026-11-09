import { describe, expect, it } from "vitest";

import {
  generateLinkCode,
  hashLinkCode,
  linkMessage,
  looksLikeLinkAttempt,
  parseLinkMessage,
} from "@/lib/whatsapp/link-code";

describe("código para ligar o número", () => {
  it("tem sempre 6 dígitos", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateLinkCode()).toMatch(/^\d{6}$/);
    }
  });

  it("o hash depende da chave e não é o SHA-256 puro", () => {
    const a = hashLinkCode("123456", "chave-a");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashLinkCode("123456", "chave-a")).toBe(a);
    expect(hashLinkCode("123456", "chave-b")).not.toBe(a);
    expect(() => hashLinkCode("123456", "")).toThrow();
  });

  it("a mensagem pronta volta a ser lida", () => {
    expect(parseLinkMessage(linkMessage("012345"))).toBe("012345");
  });

  it.each([
    ["VINCULAR 123456", "123456"],
    ["vincular 123456", "123456"],
    ["  Vincular   123456  ", "123456"],
    ["VINCULAR: 123456", "123456"],
    ["*VINCULAR* 123 456", "123456"],
    ["VINCULAR 123-456", "123456"],
  ])("lê %j", (text, code) => {
    expect(parseLinkMessage(text)).toBe(code);
  });

  it.each([
    "300 pedreiro",
    "VINCULAR",
    "VINCULAR 12345",
    "VINCULAR 1234567",
    "vincular abc",
  ])("não lê %j", (text) => {
    expect(parseLinkMessage(text)).toBeNull();
  });

  it("reconhece tentativa de vincular sem código válido", () => {
    expect(looksLikeLinkAttempt("vincular 12")).toBe(true);
    expect(looksLikeLinkAttempt("300 pedreiro")).toBe(false);
    expect(looksLikeLinkAttempt("vinculares")).toBe(false);
  });
});
