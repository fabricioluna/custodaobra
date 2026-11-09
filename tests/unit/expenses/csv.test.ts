import { describe, expect, it } from "vitest";

import {
  buildExpensesCsv,
  centsToCsvNumber,
  csvFileName,
} from "@/features/expenses/csv";

const expense = {
  spent_on: "2026-11-08",
  description: "20 sacos de cimento",
  amount_cents: 78000,
  has_invoice: true,
  invoice_number: "123",
  payment_method: "pix",
  quantity: 20,
  unit: "saco",
  unit_price_cents: 3900,
  category: { name: "Material" },
  stage: { name: "Fundação" },
  supplier: { name: "Loja do Zé" },
};

describe("buildExpensesCsv", () => {
  it("monta cabeçalho e linhas no formato do Excel em português", () => {
    const csv = buildExpensesCsv([expense]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(
      "Data;Descrição;Valor (R$);Categoria;Etapa;Fornecedor;Forma de pagamento;Nota fiscal;Número da nota;Quantidade;Unidade;Valor unitário (R$)",
    );
    expect(lines[1]).toBe(
      "08/11/2026;20 sacos de cimento;780,00;Material;Fundação;Loja do Zé;Pix;Sim;123;20;saco;39,00",
    );
  });

  it("põe aspas quando o texto tem ponto e vírgula ou aspas", () => {
    const csv = buildExpensesCsv([
      { ...expense, description: 'Areia; brita "lavada"' },
    ]);
    expect(csv).toContain('"Areia; brita ""lavada"""');
  });

  it("neutraliza fórmulas", () => {
    const csv = buildExpensesCsv([
      { ...expense, description: '=HYPERLINK("x")' },
    ]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it("marca gasto sem etapa e campos vazios", () => {
    const csv = buildExpensesCsv([
      {
        ...expense,
        stage: null,
        supplier: null,
        payment_method: null,
        has_invoice: false,
        invoice_number: null,
        quantity: 2.5,
        unit: null,
        unit_price_cents: null,
      },
    ]);
    expect(csv.split("\r\n")[1]).toBe(
      "08/11/2026;20 sacos de cimento;780,00;Material;Sem etapa;;;Não;;2,5;;",
    );
  });
});

describe("centsToCsvNumber", () => {
  it.each([
    [0, "0,00"],
    [5, "0,05"],
    [150050, "1500,50"],
  ])("%i → %s", (cents, text) => {
    expect(centsToCsvNumber(cents)).toBe(text);
  });
});

describe("csvFileName", () => {
  it("usa o nome da obra sem acentos", () => {
    expect(csvFileName("Casa do Jardim São José", "2026-11-08")).toBe(
      "gastos-casa-do-jardim-sao-jose-2026-11-08.csv",
    );
  });
});
