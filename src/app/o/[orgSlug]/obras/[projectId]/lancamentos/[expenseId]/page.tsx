import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormMessage } from "@/components/form-message";
import { deleteExpense, updateExpense } from "@/features/expenses/actions";
import { DeleteExpenseButton } from "@/features/expenses/components/delete-expense-button";
import { ExpenseForm } from "@/features/expenses/components/expense-form";
import { expensesCopy } from "@/features/expenses/copy";
import {
  getExpense,
  getExpenseFormOptions,
  getReceiptUrl,
} from "@/features/expenses/queries";
import { requireProject } from "@/features/projects/queries";
import { formatDate } from "@/lib/dates";
import { isUuid } from "@/lib/forms";
import { formatCents, formatQuantity } from "@/lib/money";

const copy = expensesCopy.edit;

export const metadata: Metadata = { title: copy.title };

export default async function ExpensePage({
  params,
}: PageProps<"/o/[orgSlug]/obras/[projectId]/lancamentos/[expenseId]">) {
  const { orgSlug, projectId, expenseId } = await params;
  const { org, project, access } = await requireProject(orgSlug, projectId);
  if (!isUuid(expenseId)) notFound();

  const [expense, options] = await Promise.all([
    getExpense(project.id, expenseId),
    getExpenseFormOptions(org.id, project.id),
  ]);
  if (!expense) notFound();

  const receipts = await Promise.all(
    expense.attachments.map(async (attachment) => ({
      ...attachment,
      url: await getReceiptUrl(attachment.storage_path),
    })),
  );

  const receiptList =
    receipts.length > 0 ? (
      <section className="mb-6">
        <h3 className="mb-3 font-semibold">{copy.receipt}</h3>
        <ul className="flex flex-wrap gap-3">
          {receipts.map((receipt) =>
            receipt.url ? (
              <li key={receipt.id}>
                <a
                  href={receipt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-start gap-2 rounded-xl border bg-card p-2 outline-none hover:border-input focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  {receipt.mime_type.startsWith("image/") ? (
                    // URL assinada e temporária: next/image não ajuda aqui.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={receipt.url}
                      alt={copy.receipt}
                      className="h-40 w-auto max-w-full rounded-lg object-cover"
                    />
                  ) : (
                    <FileText
                      className="size-16 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  <span className="px-1 text-sm font-semibold">
                    {copy.openReceipt}
                  </span>
                </a>
              </li>
            ) : null,
          )}
        </ul>
      </section>
    ) : null;

  if (!access.canEdit) {
    const rows: [string, string][] = [
      [expensesCopy.form.amount, formatCents(expense.amount_cents)],
      [expensesCopy.form.description, expense.description],
      [expensesCopy.form.category, expense.category?.name ?? ""],
      [
        expensesCopy.form.stage,
        expense.stage?.name ?? expensesCopy.list.noStage,
      ],
      [expensesCopy.form.spentOn, formatDate(expense.spent_on)],
      [expensesCopy.form.supplier, expense.supplier?.name ?? "—"],
    ];
    if (expense.quantity !== null) {
      rows.push([
        expensesCopy.form.quantity,
        `${formatQuantity(expense.quantity)} ${expense.unit ?? ""}`.trim(),
      ]);
    }
    return (
      <>
        <FormMessage className="mb-5">{copy.noPermission}</FormMessage>
        <dl className="mb-6 grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-2xl border bg-card p-4">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {receiptList}
      </>
    );
  }

  return (
    <>
      <h2 className="mb-5 text-xl heading">{copy.title}</h2>
      {receiptList}
      <ExpenseForm
        action={updateExpense.bind(null, org.slug, project.id, expense.id)}
        options={options}
        defaults={{
          amountCents: expense.amount_cents,
          description: expense.description,
          stageId: expense.stage_id ?? "",
          categoryId: expense.category_id,
          spentOn: expense.spent_on,
          supplierName: expense.supplier?.name ?? "",
          paymentMethod: expense.payment_method ?? "",
          hasInvoice: expense.has_invoice,
          invoiceNumber: expense.invoice_number ?? "",
          quantity:
            expense.quantity !== null ? formatQuantity(expense.quantity) : "",
          unit: expense.unit ?? "",
          unitPriceCents: expense.unit_price_cents ?? 0,
        }}
        submitLabel={copy.submit}
        submittingLabel={copy.submitting}
        detailsOpen
      />
      <div className="mt-10 max-w-xl border-t pt-6">
        <DeleteExpenseButton
          action={deleteExpense.bind(null, org.slug, project.id, expense.id)}
        />
      </div>
    </>
  );
}
