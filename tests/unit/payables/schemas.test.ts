import { describe, expect, it } from "vitest";

import { payablesCopy } from "@/features/payables/copy";
import { payableFormSchema, payFormSchema } from "@/features/payables/schemas";

const categoryId = "6f1c2c8e-1d2b-4c3a-9e8f-0a1b2c3d4e5f";
const stageId = "0b9e8d7c-6a5b-4c3d-8e2f-1a2b3c4d5e6f";

const valid = {
  description: "  Boleto   da madeira ",
  amountCents: "150000",
  dueDate: "2026-12-10",
  installments: "3",
  stageId,
  categoryId,
  supplierName: "",
};

describe("payableFormSchema", () => {
  it("lê os campos e limpa o texto", () => {
    const result = payableFormSchema.parse(valid);
    expect(result).toEqual({
      description: "Boleto da madeira",
      amountCents: 150_000,
      dueDate: "2026-12-10",
      installments: 3,
      stageId,
      categoryId,
      supplierName: null,
    });
  });

  it("sem etapa e sem parcelas vira null e 1", () => {
    const result = payableFormSchema.parse({
      ...valid,
      stageId: "",
      installments: "",
    });
    expect(result.stageId).toBeNull();
    expect(result.installments).toBe(1);
  });

  it("exige descrição, valor, vencimento e categoria", () => {
    const result = payableFormSchema.safeParse({
      ...valid,
      description: "   ",
      amountCents: "",
      dueDate: "2026-02-30",
      categoryId: "",
    });
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((issue) => issue.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        payablesCopy.errors.descriptionRequired,
        payablesCopy.errors.amountRequired,
        payablesCopy.errors.dateInvalid,
        payablesCopy.errors.categoryRequired,
      ]),
    );
  });

  it("recusa parcelas fora de 1 a 60 e valor menor que as parcelas", () => {
    expect(
      payableFormSchema.safeParse({ ...valid, installments: "61" }).success,
    ).toBe(false);
    expect(
      payableFormSchema.safeParse({ ...valid, installments: "abc" }).success,
    ).toBe(false);
    const tiny = payableFormSchema.safeParse({
      ...valid,
      amountCents: "2",
      installments: "3",
    });
    expect(tiny.error?.issues[0].message).toBe(
      payablesCopy.errors.amountTooLowForInstallments,
    );
  });
});

describe("payFormSchema", () => {
  it("lê data, valor, forma de pagamento e nota", () => {
    expect(
      payFormSchema.parse({
        paidOn: "2026-11-09",
        amountCents: "52000",
        paymentMethod: "boleto",
        hasInvoice: "on",
      }),
    ).toEqual({
      paidOn: "2026-11-09",
      amountCents: 52_000,
      paymentMethod: "boleto",
      hasInvoice: true,
    });
  });

  it("forma de pagamento vazia vira null e recusa valor zero", () => {
    const ok = payFormSchema.parse({
      paidOn: "2026-11-09",
      amountCents: "100",
      paymentMethod: "",
      hasInvoice: "",
    });
    expect(ok.paymentMethod).toBeNull();
    expect(ok.hasInvoice).toBe(false);
    expect(
      payFormSchema.safeParse({
        paidOn: "2026-11-09",
        amountCents: "0",
        paymentMethod: "",
        hasInvoice: "",
      }).success,
    ).toBe(false);
  });
});
