import { formatDate } from "@/lib/dates";

import { expensesCopy } from "./copy";

export type CsvExpense = {
  spent_on: string;
  description: string;
  amount_cents: number;
  has_invoice: boolean;
  invoice_number?: string | null;
  payment_method: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price_cents: number | null;
  category: { name: string } | null;
  stage: { name: string } | null;
  supplier: { name: string } | null;
};

const HEADER = [
  "Data",
  "Descrição",
  "Valor (R$)",
  "Categoria",
  "Etapa",
  "Fornecedor",
  "Forma de pagamento",
  "Nota fiscal",
  "Número da nota",
  "Quantidade",
  "Unidade",
  "Valor unitário (R$)",
];

/** Centavos como número em pt-BR sem milhar: 150050 → "1500,50" (o Excel lê como número). */
export function centsToCsvNumber(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

function quantityToCsv(quantity: number): string {
  return String(quantity).replace(".", ",");
}

/** Aspas quando precisa; e neutraliza fórmulas (=, +, -, @) contra injeção no Excel. */
function cell(value: string): string {
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[";\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * Planilha CSV no formato do Excel em português: separador ";", vírgula
 * decimal, BOM (para os acentos abrirem certo) e quebra de linha CRLF.
 */
export function buildExpensesCsv(expenses: CsvExpense[]): string {
  const methods: Record<string, string> = expensesCopy.paymentMethods;
  const rows = expenses.map((expense) =>
    [
      formatDate(expense.spent_on),
      expense.description,
      centsToCsvNumber(expense.amount_cents),
      expense.category?.name ?? "",
      expense.stage?.name ?? expensesCopy.list.noStage,
      expense.supplier?.name ?? "",
      expense.payment_method ? (methods[expense.payment_method] ?? "") : "",
      expense.has_invoice ? "Sim" : "Não",
      expense.invoice_number ?? "",
      expense.quantity !== null ? quantityToCsv(expense.quantity) : "",
      expense.unit ?? "",
      expense.unit_price_cents !== null
        ? centsToCsvNumber(expense.unit_price_cents)
        : "",
    ]
      .map(cell)
      .join(";"),
  );
  return `﻿${[HEADER.join(";"), ...rows].join("\r\n")}\r\n`;
}

/** Nome do arquivo: gastos-casa-do-jardim-2026-11-08.csv */
export function csvFileName(projectName: string, today: string): string {
  const slug =
    projectName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "obra";
  return `gastos-${slug}-${today}.csv`;
}
