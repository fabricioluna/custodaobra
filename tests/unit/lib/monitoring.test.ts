import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import {
  describeArg,
  redactText,
  scrubBreadcrumb,
  scrubEvent,
} from "@/lib/monitoring/sentry";

describe("redactText", () => {
  it("tira telefone, CPF, CNPJ, chave e e-mail", () => {
    expect(redactText("número 5587991125300 recusado")).toBe(
      "número [número] recusado",
    );
    expect(redactText("CPF 123.456.789-09")).toBe("CPF [número]");
    expect(redactText("CNPJ 12.345.678/0001-95")).toBe("CNPJ [número]");
    expect(redactText("+55 (87) 99112-5300")).toBe("[número]");
    expect(redactText("de ana.silva@gmail.com")).toBe("de [e-mail]");
  });

  it("mantém datas, valores e códigos curtos", () => {
    expect(redactText("2026-11-12 R$ 1.500,00 erro 131030")).toBe(
      "2026-11-12 R$ 1.500,00 erro 131030",
    );
  });

  it("corta texto longo", () => {
    expect(redactText("a".repeat(400))).toHaveLength(301);
  });
});

describe("describeArg", () => {
  it("guarda só nome, código, status e mensagem limpa de um objeto", () => {
    expect(
      describeArg({
        name: "PostgrestError",
        code: "23505",
        message: "falhou para 5587991125300",
        details: "Key (document)=(12345678000195) already exists",
        output: { supplier_name: "Loja do Zé" },
      }),
    ).toEqual({
      name: "PostgrestError",
      code: "23505",
      message: "falhou para [número]",
    });
  });

  it("mantém ids e números", () => {
    const id = "0b7f2c1e-1d2a-4c3b-9a8e-7f6d5c4b3a21";
    expect(describeArg(id)).toBe(id);
    expect(describeArg(429)).toBe(429);
  });
});

function consoleEvent(args: unknown[], message?: string): ErrorEvent {
  return {
    type: undefined,
    logger: "console",
    message,
    extra: { arguments: args },
  };
}

describe("scrubEvent", () => {
  it("descarta o console.error do Next.js e do React (sem prefixo)", () => {
    expect(scrubEvent(consoleEvent(["Error: boom"], "Error: boom"))).toBeNull();
  });

  it("mantém só o prefixo e o resumo dos argumentos", () => {
    const event = scrubEvent(
      consoleEvent(
        ["[ia] saída inválida (recibo)", { message: "CPF 12345678909" }],
        "[ia] saída inválida (recibo) CPF 12345678909 Loja do Zé",
      ),
    );
    expect(event?.message).toBe("[ia] saída inválida (recibo)");
    expect(event?.extra).toEqual({
      context: "[ia] saída inválida (recibo)",
      details: [{ message: "CPF [número]" }],
    });
  });

  it("limpa o texto das exceções", () => {
    const event = scrubEvent({
      type: undefined,
      exception: {
        values: [{ type: "Error", value: "telefone 5587991125300" }],
      },
    });
    expect(event?.exception?.values?.[0]?.value).toBe("telefone [número]");
  });
});

describe("scrubBreadcrumb", () => {
  it("tira a trilha do console", () => {
    expect(scrubBreadcrumb({ category: "console", message: "x" })).toBeNull();
    expect(scrubBreadcrumb({ category: "navigation" })).toEqual({
      category: "navigation",
    });
  });
});
