import { describe, expect, it } from "vitest";

import { emailSchema, otpSchema } from "@/features/auth/schemas";
import { onboardingSchema } from "@/features/organizations/schemas";

describe("emailSchema", () => {
  it("normaliza espaços e maiúsculas", () => {
    expect(emailSchema.parse("  Fulano@Exemplo.COM ")).toBe(
      "fulano@exemplo.com",
    );
  });

  it.each(["", "fulano", "fulano@", "@exemplo.com", "fulano exemplo.com"])(
    "rejeita %j",
    (value) => {
      expect(emailSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("otpSchema", () => {
  it.each([
    ["123456", "123456"],
    ["123 456", "123456"],
    [" 12345678 ", "12345678"],
  ])("aceita %j", (value, expected) => {
    expect(otpSchema.parse(value)).toBe(expected);
  });

  it.each(["", "12345", "12a456", "123456789"])("rejeita %j", (value) => {
    expect(otpSchema.safeParse(value).success).toBe(false);
  });
});

describe("onboardingSchema", () => {
  it("limpa espaços repetidos", () => {
    expect(
      onboardingSchema.parse({
        fullName: "  Maria   das Dores ",
        accountName: " Construtora  Silva ",
      }),
    ).toEqual({
      fullName: "Maria das Dores",
      accountName: "Construtora Silva",
    });
  });

  it("exige os dois nomes, com mensagem para a pessoa", () => {
    const result = onboardingSchema.safeParse({
      fullName: "   ",
      accountName: "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toEqual([
      "Digite seu nome.",
      "Digite o nome da conta.",
    ]);
  });

  it("limita o tamanho do nome da conta", () => {
    const result = onboardingSchema.safeParse({
      fullName: "Maria",
      accountName: "x".repeat(81),
    });
    expect(result.success).toBe(false);
  });
});
