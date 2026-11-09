import { describe, expect, it } from "vitest";

import {
  expenseFormSchema,
  filtersToSearchParams,
  parseExpenseFilters,
} from "@/features/expenses/schemas";

const CATEGORY = "3f6f1a8e-2b7c-4d1e-9a0b-5c6d7e8f9a0b";
const STAGE = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

const base = {
  amountCents: "30000",
  description: "",
  stageId: "",
  categoryId: CATEGORY,
  spentOn: "2026-11-08",
  supplierName: "",
  paymentMethod: "",
  hasInvoice: "",
  invoiceNumber: "",
  quantity: "",
  unit: "",
  unitPriceCents: "",
};

describe("expenseFormSchema", () => {
  it("aceita o mínimo: valor, categoria e data", () => {
    const result = expenseFormSchema.parse(base);
    expect(result).toMatchObject({
      amountCents: 30000,
      description: null,
      stageId: null,
      supplierName: null,
      paymentMethod: null,
      hasInvoice: false,
      quantity: null,
    });
  });

  it("exige valor maior que zero", () => {
    const result = expenseFormSchema.safeParse({ ...base, amountCents: "" });
    expect(result.success).toBe(false);
  });

  it("recusa R$ 10 milhões ou mais", () => {
    const result = expenseFormSchema.safeParse({
      ...base,
      amountCents: "1000000000",
    });
    expect(result.success).toBe(false);
  });

  it("lê etapa, nota e quantidade × valor unitário", () => {
    const result = expenseFormSchema.parse({
      ...base,
      amountCents: "78000",
      description: "  20 sacos   de cimento ",
      stageId: STAGE,
      paymentMethod: "pix",
      hasInvoice: "on",
      invoiceNumber: "123",
      quantity: "20",
      unit: "saco",
      unitPriceCents: "3900",
    });
    expect(result).toMatchObject({
      description: "20 sacos de cimento",
      stageId: STAGE,
      paymentMethod: "pix",
      hasInvoice: true,
      invoiceNumber: "123",
      quantity: 20,
      unit: "saco",
      unitPriceCents: 3900,
    });
  });

  it("descarta número da nota sem nota e unidade sem quantidade", () => {
    const result = expenseFormSchema.parse({
      ...base,
      invoiceNumber: "999",
      unit: "saco",
      unitPriceCents: "3900",
    });
    expect(result.invoiceNumber).toBeNull();
    expect(result.unit).toBeNull();
    expect(result.unitPriceCents).toBeNull();
  });

  it("recusa data inválida e categoria vazia", () => {
    expect(
      expenseFormSchema.safeParse({ ...base, spentOn: "2026-02-30" }).success,
    ).toBe(false);
    expect(
      expenseFormSchema.safeParse({ ...base, categoryId: "" }).success,
    ).toBe(false);
  });
});

describe("filtros da lista", () => {
  it("ignora valores inválidos", () => {
    expect(
      parseExpenseFilters({
        de: "ontem",
        etapa: "qualquer",
        nota: "talvez",
        categoria: CATEGORY,
      }),
    ).toEqual({
      q: null,
      de: null,
      ate: null,
      etapa: null,
      categoria: CATEGORY,
      fornecedor: null,
      nota: null,
    });
  });

  it("aceita 'sem' etapa e devolve a mesma URL", () => {
    const filters = parseExpenseFilters({
      etapa: "sem",
      nota: "com",
      q: " cimento ",
    });
    expect(filtersToSearchParams(filters)).toBe(
      "?q=cimento&etapa=sem&nota=com",
    );
  });
});
