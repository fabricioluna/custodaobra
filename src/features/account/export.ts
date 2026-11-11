import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

import { expensesCopy } from "@/features/expenses/copy";
import { membersCopy } from "@/features/members/copy";
import { projectsCopy } from "@/features/projects/copy";
import type { Database } from "@/types/database";

import { accountCopy } from "./copy";

type Client = SupabaseClient<Database>;
type Cell = string | number | Date | null;
type Kind = "text" | "money" | "date" | "number";
type Sheet = {
  name: string;
  columns: { header: string; width: number; kind?: Kind }[];
  rows: Cell[][];
};

const PAGE_SIZE = 1000;
/** Teto por tabela, para a exportação não rodar para sempre. */
const MAX_ROWS = 50_000;

const copy = accountCopy.export;

/**
 * Busca todas as linhas que a pessoa pode ver (o RLS filtra), em páginas de
 * 1000, que é o máximo que o Supabase devolve por consulta.
 */
async function fetchAll<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  onTruncated: () => void,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    // Chegou ao teto com mais linhas pela frente: a planilha avisa.
    if (rows.length >= MAX_ROWS) {
      onTruncated();
      break;
    }
  }
  return rows;
}

const money = (cents: number | null) => (cents === null ? null : cents / 100);
const date = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const yesNo = (value: boolean) => (value ? "Sim" : "Não");

/**
 * Planilha com todos os dados que a pessoa pode ver, em todas as contas de
 * que participa (portabilidade, LGPD art. 18). Roda com a sessão dela: o RLS
 * decide o que entra. As fotos dos comprovantes não vão no arquivo; a aba
 * "Comprovantes" lista quais existem.
 */
export async function buildAccountExport(
  supabase: Client,
  user: { id: string; email: string | null },
): Promise<Buffer> {
  const truncated: string[] = [];
  const cut = (sheet: string) => () => truncated.push(sheet);
  const [
    profile,
    orgs,
    projects,
    stages,
    expenses,
    items,
    suppliers,
    payables,
    attachments,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, whatsapp_phone, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    fetchAll(
      (from, to) =>
        supabase
          .from("organization_members")
          .select("role, organizations(name, created_at)")
          .eq("user_id", user.id)
          .order("org_id")
          .range(from, to),
      cut(copy.sheets.accounts),
    ),
    fetchAll(
      (from, to) =>
        supabase
          .from("projects")
          .select(
            "id, name, address, city, state, built_area_m2, standard, start_date, expected_end_date, status, cost_per_m2_cents, archived_at, organizations(name)",
          )
          .order("created_at")
          .order("id")
          .range(from, to),
      cut(copy.sheets.projects),
    ),
    fetchAll(
      (from, to) =>
        supabase
          .from("stages")
          .select(
            "name, sort_order, budget_cents, progress_percent, projects(name)",
          )
          .order("project_id")
          .order("sort_order")
          .order("id")
          .range(from, to),
      cut(copy.sheets.stages),
    ),
    fetchAll(
      (from, to) =>
        supabase
          .from("expenses")
          .select(
            "id, spent_on, description, amount_cents, payment_method, has_invoice, invoice_number, nfe_access_key, quantity, unit, unit_price_cents, status, source, raw_input, deleted_at, projects(name), categories(name), stages(name), suppliers(name)",
          )
          .order("spent_on")
          .order("id")
          .range(from, to),
      cut(copy.sheets.expenses),
    ),
    fetchAll(
      (from, to) =>
        supabase
          .from("expense_items")
          .select(
            "description, quantity, unit, unit_price_cents, total_cents, expenses(description, spent_on, projects(name))",
          )
          .order("expense_id")
          .order("id")
          .range(from, to),
      cut(copy.sheets.items),
    ),
    fetchAll(
      (from, to) =>
        supabase
          .from("suppliers")
          .select("name, document, phone, kind, organizations(name)")
          .order("name")
          .order("id")
          .range(from, to),
      cut(copy.sheets.suppliers),
    ),
    fetchAll(
      (from, to) =>
        supabase
          .from("payables")
          .select(
            "description, amount_cents, due_date, status, installment_number, installment_total, projects(name)",
          )
          .order("due_date")
          .order("id")
          .range(from, to),
      cut(copy.sheets.payables),
    ),
    fetchAll(
      (from, to) =>
        supabase
          .from("attachments")
          .select(
            "storage_path, mime_type, size_bytes, created_at, expenses(description, spent_on, projects(name))",
          )
          .order("created_at")
          .order("id")
          .range(from, to),
      cut(copy.sheets.attachments),
    ),
  ]);
  if (profile.error) throw profile.error;

  const methods: Record<string, string> = expensesCopy.paymentMethods;
  const sheets: Sheet[] = [
    {
      name: copy.sheets.profile,
      columns: [
        { header: copy.columns.name, width: 30 },
        { header: copy.columns.email, width: 34 },
        { header: copy.columns.whatsapp, width: 18 },
        { header: copy.columns.createdAt, width: 14, kind: "date" },
      ],
      rows: [
        [
          profile.data?.full_name ?? "",
          user.email ?? "",
          profile.data?.whatsapp_phone ?? "",
          date(profile.data?.created_at ?? null),
        ],
      ],
    },
    {
      name: copy.sheets.accounts,
      columns: [
        { header: copy.columns.account, width: 30 },
        { header: copy.columns.role, width: 16 },
        { header: copy.columns.createdAt, width: 14, kind: "date" },
      ],
      rows: orgs.map((m) => [
        m.organizations?.name ?? "",
        membersCopy.roles[m.role],
        date(m.organizations?.created_at ?? null),
      ]),
    },
    {
      name: copy.sheets.projects,
      columns: [
        { header: copy.columns.account, width: 24 },
        { header: copy.columns.project, width: 28 },
        { header: copy.columns.address, width: 34 },
        { header: copy.columns.city, width: 18 },
        { header: copy.columns.state, width: 6 },
        { header: copy.columns.area, width: 12, kind: "number" },
        { header: copy.columns.costPerM2, width: 14, kind: "money" },
        { header: copy.columns.start, width: 12, kind: "date" },
        { header: copy.columns.end, width: 12, kind: "date" },
        { header: copy.columns.status, width: 16 },
        { header: copy.columns.archived, width: 12, kind: "date" },
      ],
      rows: projects.map((p) => [
        p.organizations?.name ?? "",
        p.name,
        p.address ?? "",
        p.city ?? "",
        p.state ?? "",
        p.built_area_m2,
        money(p.cost_per_m2_cents),
        date(p.start_date),
        date(p.expected_end_date),
        projectsCopy.statuses[p.status],
        date(p.archived_at),
      ]),
    },
    {
      name: copy.sheets.stages,
      columns: [
        { header: copy.columns.project, width: 28 },
        { header: copy.columns.stage, width: 32 },
        { header: copy.columns.order, width: 8, kind: "number" },
        { header: copy.columns.budget, width: 14, kind: "money" },
        { header: copy.columns.progress, width: 12, kind: "number" },
      ],
      rows: stages.map((s) => [
        s.projects?.name ?? "",
        s.name,
        s.sort_order,
        money(s.budget_cents),
        s.progress_percent,
      ]),
    },
    {
      name: copy.sheets.expenses,
      columns: [
        { header: copy.columns.project, width: 24 },
        { header: copy.columns.date, width: 12, kind: "date" },
        { header: copy.columns.description, width: 36 },
        { header: copy.columns.amount, width: 14, kind: "money" },
        { header: copy.columns.category, width: 20 },
        { header: copy.columns.stage, width: 24 },
        { header: copy.columns.supplier, width: 24 },
        { header: copy.columns.payment, width: 16 },
        { header: copy.columns.invoice, width: 8 },
        { header: copy.columns.invoiceNumber, width: 14 },
        { header: copy.columns.nfeKey, width: 46 },
        { header: copy.columns.quantity, width: 10, kind: "number" },
        { header: copy.columns.unit, width: 10 },
        { header: copy.columns.unitPrice, width: 14, kind: "money" },
        { header: copy.columns.status, width: 12 },
        { header: copy.columns.source, width: 16 },
        { header: copy.columns.rawInput, width: 40 },
        { header: copy.columns.deletedAt, width: 12, kind: "date" },
      ],
      rows: expenses.map((e) => [
        e.projects?.name ?? "",
        date(e.spent_on),
        e.description,
        money(e.amount_cents),
        e.categories?.name ?? "",
        e.stages?.name ?? "",
        e.suppliers?.name ?? "",
        e.payment_method ? (methods[e.payment_method] ?? "") : "",
        yesNo(e.has_invoice),
        e.invoice_number ?? "",
        e.nfe_access_key ?? "",
        e.quantity,
        e.unit ?? "",
        money(e.unit_price_cents),
        copy.expenseStatus[e.status],
        copy.sources[e.source],
        e.raw_input ?? "",
        date(e.deleted_at),
      ]),
    },
    {
      name: copy.sheets.items,
      columns: [
        { header: copy.columns.project, width: 24 },
        { header: copy.columns.date, width: 12, kind: "date" },
        { header: copy.columns.expense, width: 30 },
        { header: copy.columns.item, width: 34 },
        { header: copy.columns.quantity, width: 10, kind: "number" },
        { header: copy.columns.unit, width: 10 },
        { header: copy.columns.unitPrice, width: 14, kind: "money" },
        { header: copy.columns.amount, width: 14, kind: "money" },
      ],
      rows: items.map((i) => [
        i.expenses?.projects?.name ?? "",
        date(i.expenses?.spent_on ?? null),
        i.expenses?.description ?? "",
        i.description,
        i.quantity,
        i.unit ?? "",
        money(i.unit_price_cents),
        money(i.total_cents),
      ]),
    },
    {
      name: copy.sheets.suppliers,
      columns: [
        { header: copy.columns.account, width: 24 },
        { header: copy.columns.supplier, width: 30 },
        { header: copy.columns.document, width: 20 },
        { header: copy.columns.phone, width: 18 },
        { header: copy.columns.kind, width: 14 },
      ],
      rows: suppliers.map((s) => [
        s.organizations?.name ?? "",
        s.name,
        s.document ?? "",
        s.phone ?? "",
        copy.supplierKinds[s.kind],
      ]),
    },
    {
      name: copy.sheets.payables,
      columns: [
        { header: copy.columns.project, width: 24 },
        { header: copy.columns.description, width: 34 },
        { header: copy.columns.amount, width: 14, kind: "money" },
        { header: copy.columns.dueDate, width: 12, kind: "date" },
        { header: copy.columns.status, width: 12 },
        { header: copy.columns.installment, width: 10 },
      ],
      rows: payables.map((p) => [
        p.projects?.name ?? "",
        p.description,
        money(p.amount_cents),
        date(p.due_date),
        copy.payableStatus[p.status],
        p.installment_total && p.installment_total > 1
          ? `${p.installment_number}/${p.installment_total}`
          : "",
      ]),
    },
    {
      name: copy.sheets.attachments,
      columns: [
        { header: copy.columns.project, width: 24 },
        { header: copy.columns.date, width: 12, kind: "date" },
        { header: copy.columns.expense, width: 30 },
        { header: copy.columns.file, width: 60 },
        { header: copy.columns.type, width: 16 },
        { header: copy.columns.sizeKb, width: 10, kind: "number" },
      ],
      rows: attachments.map((a) => [
        a.expenses?.projects?.name ?? "",
        date(a.expenses?.spent_on ?? null),
        a.expenses?.description ?? "",
        a.storage_path.split("/").pop() ?? "",
        a.mime_type,
        Math.round(a.size_bytes / 1024),
      ]),
    },
  ];

  if (truncated.length) {
    sheets.unshift({
      name: copy.sheets.notice,
      columns: [{ header: copy.columns.notice, width: 90 }],
      rows: [[copy.truncated(MAX_ROWS, truncated)]],
    });
  }

  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.columns = sheet.columns.map((c) => ({
      header: c.header,
      width: c.width,
    }));
    ws.getRow(1).font = { bold: true };
    sheet.columns.forEach((c, index) => {
      if (c.kind === "money") ws.getColumn(index + 1).numFmt = '"R$" #,##0.00';
      if (c.kind === "date") ws.getColumn(index + 1).numFmt = "dd/mm/yyyy";
    });
    // Texto vai como texto: nada vira fórmula.
    for (const row of sheet.rows) ws.addRow(row);
  }
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}
