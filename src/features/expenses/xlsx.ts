import "server-only";

import ExcelJS from "exceljs";

import { expensesCopy } from "./copy";
import { EXPORT_HEADER, type CsvExpense } from "./csv";

const MONEY_FORMAT = '"R$" #,##0.00';
const COLUMN_WIDTHS = [12, 40, 14, 22, 26, 26, 20, 12, 16, 12, 12, 18];
const MONEY_COLUMNS = [3, 12];

/** "2026-11-08" vira uma data de verdade no Excel, sem fuso (meia-noite UTC). */
function isoToExcelDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Planilha XLSX com as mesmas colunas do CSV, mas com data e dinheiro como
 * números de verdade (dá para somar e filtrar direto no Excel). Texto é
 * gravado como texto, então não há risco de virar fórmula como no CSV.
 */
export async function buildExpensesXlsx(
  expenses: CsvExpense[],
  sheetName: string,
): Promise<Buffer> {
  const methods: Record<string, string> = expensesCopy.paymentMethods;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(
    // O Excel não aceita alguns caracteres e mais de 31 no nome da aba.
    sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Gastos",
    { views: [{ state: "frozen", ySplit: 1 }] },
  );

  sheet.columns = EXPORT_HEADER.map((header, index) => ({
    header,
    width: COLUMN_WIDTHS[index],
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn(1).numFmt = "dd/mm/yyyy";
  for (const column of MONEY_COLUMNS) {
    sheet.getColumn(column).numFmt = MONEY_FORMAT;
  }

  for (const expense of expenses) {
    sheet.addRow([
      isoToExcelDate(expense.spent_on),
      expense.description,
      expense.amount_cents / 100,
      expense.category?.name ?? "",
      expense.stage?.name ?? expensesCopy.list.noStage,
      expense.supplier?.name ?? "",
      expense.payment_method ? (methods[expense.payment_method] ?? "") : "",
      expense.has_invoice ? "Sim" : "Não",
      expense.invoice_number ?? "",
      expense.quantity,
      expense.unit ?? "",
      expense.unit_price_cents !== null ? expense.unit_price_cents / 100 : null,
    ]);
  }

  if (expenses.length > 0) {
    const last = expenses.length + 1;
    const totalRow = sheet.addRow([]);
    totalRow.getCell(2).value = expensesCopy.list.exportTotal;
    totalRow.getCell(3).value = {
      formula: `SUM(C2:C${last})`,
      result: expenses.reduce((sum, e) => sum + e.amount_cents, 0) / 100,
    };
    totalRow.font = { bold: true };
  }

  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}
