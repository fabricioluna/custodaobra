// @vitest-environment node
import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildExpensesXlsx } from "@/features/expenses/xlsx";

const expense = {
  spent_on: "2026-11-08",
  description: "=20 sacos de cimento",
  amount_cents: 78050,
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

async function read(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook.worksheets[0];
}

describe("buildExpensesXlsx", () => {
  it("grava data e dinheiro como números, com cabeçalho e total", async () => {
    const sheet = await read(
      await buildExpensesXlsx(
        [expense, { ...expense, amount_cents: 1000, stage: null }],
        "Casa: do/Jardim",
      ),
    );
    expect(sheet.name).toBe("Casa  do Jardim");
    expect(sheet.getRow(1).getCell(1).value).toBe("Data");
    expect(sheet.getRow(1).getCell(3).value).toBe("Valor (R$)");

    const row = sheet.getRow(2);
    expect(row.getCell(1).value).toEqual(new Date(Date.UTC(2026, 10, 8)));
    expect(row.getCell(1).numFmt).toBe("dd/mm/yyyy");
    // Texto com "=" continua texto, não vira fórmula.
    expect(row.getCell(2).value).toBe("=20 sacos de cimento");
    expect(row.getCell(3).value).toBe(780.5);
    expect(row.getCell(3).numFmt).toBe('"R$" #,##0.00');
    expect(row.getCell(7).value).toBe("Pix");
    expect(row.getCell(10).value).toBe(20);
    expect(row.getCell(12).value).toBe(39);
    expect(sheet.getRow(3).getCell(5).value).toBe("Sem etapa");

    const total = sheet.getRow(4).getCell(3).value as {
      formula: string;
      result: number;
    };
    expect(total.formula).toBe("SUM(C2:C3)");
    expect(total.result).toBe(790.5);
  });

  it("gera planilha só com cabeçalho quando não há gastos", async () => {
    const sheet = await read(await buildExpensesXlsx([], ""));
    expect(sheet.name).toBe("Gastos");
    expect(sheet.rowCount).toBe(1);
  });
});
