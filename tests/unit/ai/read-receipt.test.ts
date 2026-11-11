import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  buildReceiptText,
  interpretAiReceipt,
  interpretItems,
  itemsMatchingTotal,
  receiptMimeType,
} = await import("@/lib/ai/read-receipt");
type AiReceipt = import("@/lib/ai/read-receipt").AiReceipt;

const context = {
  today: "2026-11-10",
  stages: [
    { id: "s-fundacao", name: "Fundação" },
    { id: "s-cobertura", name: "Cobertura" },
  ],
  suppliers: ["Casa do Construtor"],
};

const raw = (fields: Partial<AiReceipt> = {}): AiReceipt => ({
  is_receipt: true,
  is_fiscal: true,
  amount_brl: 156,
  description: "cimento e areia",
  category_code: "material",
  stage_number: null,
  supplier_name: "Casa do Construtor",
  supplier_document: "11.222.333/0001-81",
  invoice_number: "Nº 000.123",
  access_key: "2611 1111 2223 3300 0181 6500 1000 0123 4510 0012 3450",
  spent_on: "2026-11-08",
  payment_method: "pix",
  items: [
    {
      description: "Cimento CP II 50kg",
      quantity: 2,
      unit: "saco",
      unit_price_brl: 39,
      total_brl: 78,
    },
    {
      description: "Areia média",
      quantity: 1,
      unit: "m³",
      unit_price_brl: 78,
      total_brl: 78,
    },
  ],
  confidence: 0.9,
  missing_fields: ["stage"],
  ...fields,
});

describe("leitura de comprovante: regras do app", () => {
  it("monta o lançamento e os detalhes do documento", () => {
    const read = interpretAiReceipt(raw(), null, context);
    expect(read?.expense).toMatchObject({
      amountCents: 15600,
      description: "Cimento e areia",
      categoryCode: "material",
      supplierName: "Casa do Construtor",
      spentOn: "2026-11-08",
      paymentMethod: "pix",
      hasInvoice: true,
      stageId: null,
    });
    expect(read?.details).toEqual({
      supplierDocument: "11222333000181",
      invoiceNumber: "000123",
      accessKey: "26111111222333000181650010000123451000123450",
      items: [
        {
          description: "Cimento CP II 50kg",
          quantity: 2,
          unit: "saco",
          unitPriceCents: 3900,
          totalCents: 7800,
        },
        {
          description: "Areia média",
          quantity: 1,
          unit: "m³",
          unitPriceCents: 7800,
          totalCents: 7800,
        },
      ],
    });
  });

  it("não é comprovante: null", () => {
    expect(interpretAiReceipt(raw({ is_receipt: false }), null, context)).toBe(
      null,
    );
  });

  it("CNPJ e chave com dígito errado não são gravados", () => {
    const read = interpretAiReceipt(
      raw({
        supplier_document: "11222333000180",
        access_key: "26111111222333000181650010000123451000123451",
      }),
      null,
      context,
    );
    expect(read?.details.supplierDocument).toBeNull();
    expect(read?.details.accessKey).toBeNull();
  });

  it("recibo (não fiscal) fica sem nota", () => {
    const read = interpretAiReceipt(
      raw({ is_fiscal: false, items: [] }),
      null,
      context,
    );
    expect(read?.expense.hasInvoice).toBe(false);
  });

  it("sem total: pergunta o valor e guarda os itens para conferir depois", () => {
    const read = interpretAiReceipt(raw({ amount_brl: null }), null, context);
    expect(read?.expense.amountCents).toBeNull();
    expect(read?.expense.missing).toContain("amount");
    expect(read?.details.items).toEqual([]);
    const unchecked = read?.details.uncheckedItems ?? [];
    expect(unchecked).toHaveLength(2);
    // O valor que a pessoa mandar decide se os itens valem.
    expect(itemsMatchingTotal(unchecked, 15600)).toHaveLength(2);
    expect(itemsMatchingTotal(unchecked, 30000)).toEqual([]);
  });

  it("com total, não guarda itens para conferir", () => {
    const read = interpretAiReceipt(raw(), null, context);
    expect(read?.details.uncheckedItems).toBeUndefined();
  });

  it("data no futuro vira hoje", () => {
    const read = interpretAiReceipt(
      raw({ spent_on: "2027-01-01" }),
      null,
      context,
    );
    expect(read?.expense.spentOn).toBe("2026-11-10");
  });

  it("um item só com quantidade vira quantidade do lançamento", () => {
    const read = interpretAiReceipt(
      raw({
        amount_brl: 140,
        items: [
          {
            description: "Telha colonial",
            quantity: 40,
            unit: "unidade",
            unit_price_brl: 3.5,
            total_brl: 140,
          },
        ],
      }),
      null,
      context,
    );
    expect(read?.expense).toMatchObject({ quantity: 40, unit: "unidade" });
  });
});

describe("itens do cupom", () => {
  const item = (total: number) => ({
    description: "Item",
    quantity: null,
    unit: null,
    unit_price_brl: null,
    total_brl: total,
  });

  it("valem quando a soma bate com o total (com folga pequena)", () => {
    expect(interpretItems([item(50), item(50)], 10000)).toHaveLength(2);
    // Arredondamento de R$ 1 para menos: dentro da folga.
    expect(interpretItems([item(50), item(49)], 10000)).toHaveLength(2);
    // Desconto de R$ 9 no fim do cupom: a soma passa do total pago.
    expect(interpretItems([item(50), item(59)], 10000)).toHaveLength(2);
  });

  it("somando diferente do total, nenhum item vale", () => {
    expect(interpretItems([item(50), item(20)], 10000)).toEqual([]);
    // Soma 15% acima do total: algum item foi lido errado.
    expect(interpretItems([item(50), item(65)], 10000)).toEqual([]);
    // Soma R$ 5 abaixo do total: faltou item.
    expect(interpretItems([item(50), item(45)], 10000)).toEqual([]);
  });

  it("item sem total invalida a lista", () => {
    expect(
      interpretItems([item(100), { ...item(0), total_brl: null }], 10000),
    ).toEqual([]);
  });
});

describe("tipo do arquivo", () => {
  it("aceita JPG, PNG, WebP e PDF", () => {
    expect(receiptMimeType("image/jpeg")).toBe("image/jpeg");
    expect(receiptMimeType("IMAGE/PNG")).toBe("image/png");
    expect(receiptMimeType("application/pdf; charset=binary")).toBe(
      "application/pdf",
    );
  });

  it("recusa o resto", () => {
    expect(receiptMimeType("image/heic")).toBeNull();
    expect(receiptMimeType("application/zip")).toBeNull();
    expect(receiptMimeType("")).toBeNull();
  });
});

describe("texto que acompanha a imagem", () => {
  it("leva o contexto e a legenda", () => {
    const text = buildReceiptText("telhas da varanda", context);
    expect(text).toContain("Hoje: 2026-11-10 (terça-feira)");
    expect(text).toContain("2. Cobertura");
    expect(text).toContain("<legenda>\ntelhas da varanda\n</legenda>");
  });

  it("sem legenda, sem o bloco", () => {
    expect(buildReceiptText(null, context)).not.toContain("<legenda>");
  });
});
