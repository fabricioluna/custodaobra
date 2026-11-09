import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { FormMessage } from "@/components/form-message";
import { orgPath } from "@/components/layout/nav";
import { buttonVariants } from "@/components/ui/button";
import { getExpenseFormOptions } from "@/features/expenses/queries";
import {
  payPayable,
  setPayableCancelled,
  updatePayable,
} from "@/features/payables/actions";
import { PayForm } from "@/features/payables/components/pay-form";
import { PayableForm } from "@/features/payables/components/payable-form";
import {
  dueLabel,
  PayableList,
} from "@/features/payables/components/payable-list";
import { PayableStatusButton } from "@/features/payables/components/payable-status-button";
import { payablesCopy } from "@/features/payables/copy";
import { getPayable } from "@/features/payables/queries";
import { requireProject } from "@/features/projects/queries";
import { formatDate, todayIn } from "@/lib/dates";
import { isUuid } from "@/lib/forms";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const copy = payablesCopy.edit;
const formCopy = payablesCopy.form;

export const metadata: Metadata = { title: copy.title };

export default async function PayablePage({
  params,
}: PageProps<"/o/[orgSlug]/obras/[projectId]/contas/[payableId]">) {
  const { orgSlug, projectId, payableId } = await params;
  const { org, project, access } = await requireProject(orgSlug, projectId);
  if (!isUuid(payableId)) notFound();

  const [payable, options] = await Promise.all([
    getPayable(project.id, payableId),
    access.canEdit ? getExpenseFormOptions(org.id, project.id) : null,
  ]);
  if (!payable) notFound();

  const today = todayIn(org.timezone);
  const base = orgPath(org.slug, "obras", project.id);

  const rows: [string, string][] = [
    [formCopy.amount, formatCents(payable.amount_cents)],
    [formCopy.dueDate, formatDate(payable.due_date)],
    [formCopy.category, payable.category?.name ?? ""],
    [formCopy.stage, payable.stage?.name ?? formCopy.noStage],
  ];
  if (payable.installment_total) {
    rows.push([
      formCopy.installments,
      `${payable.installment_number}/${payable.installment_total}`,
    ]);
  }
  if (payable.supplier) rows.push([formCopy.supplier, payable.supplier.name]);

  const open = payable.status === "open";

  return (
    <>
      <div className="mb-6 max-w-xl">
        <h2 className="text-xl heading">{payable.description}</h2>
        {open ? (
          <p className="mt-1 font-semibold">
            {dueLabel(payable.due_date, today)}
          </p>
        ) : null}
      </div>

      {payable.status === "paid" && payable.paid_expense ? (
        <div className="mb-6 flex max-w-xl flex-col gap-3">
          <FormMessage tone="success">
            {copy.paidNotice(
              formatCents(payable.paid_expense.amount_cents),
              formatDate(payable.paid_expense.spent_on),
            )}
          </FormMessage>
          <Link
            href={`${base}/lancamentos/${payable.paid_expense.id}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "self-start rounded-xl",
            )}
          >
            {copy.seeExpense}
          </Link>
          {access.canEdit ? (
            <p className="text-sm text-muted-foreground">{copy.paidHint}</p>
          ) : null}
        </div>
      ) : null}

      {payable.status === "cancelled" ? (
        <div className="mb-6 flex max-w-xl flex-col gap-3">
          <p className="rounded-xl bg-muted px-4 py-3">
            {copy.cancelledNotice}
          </p>
          {access.canEdit ? (
            <PayableStatusButton
              mode="reopen"
              action={setPayableCancelled.bind(
                null,
                org.slug,
                project.id,
                payable.id,
                false,
              )}
            />
          ) : null}
        </div>
      ) : null}

      {!access.canEdit ? (
        <FormMessage className="mb-5 max-w-xl">{copy.readOnly}</FormMessage>
      ) : null}

      <dl className="mb-6 grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-2xl border bg-card p-4">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      {open && access.canEdit && options ? (
        <>
          <Card title={payablesCopy.pay.title}>
            <p className="mb-5 text-muted-foreground">
              {payablesCopy.pay.description}
            </p>
            <PayForm
              action={payPayable.bind(null, org.slug, project.id, payable.id)}
              defaults={{
                paidOn: today,
                amountCents: payable.amount_cents,
                paymentMethod: "",
              }}
            />
          </Card>

          <details className="group mb-6 max-w-xl rounded-2xl border bg-card">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
              <span className="flex-1">{copy.editTitle}</span>
              <ChevronDown
                aria-hidden
                className="size-5 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t px-4 pt-5 pb-6">
              <PayableForm
                action={updatePayable.bind(
                  null,
                  org.slug,
                  project.id,
                  payable.id,
                )}
                options={options}
                defaults={{
                  description: payable.description,
                  amountCents: payable.amount_cents,
                  dueDate: payable.due_date,
                  stageId: payable.stage_id ?? "",
                  categoryId: payable.category_id,
                  supplierName: payable.supplier?.name ?? "",
                }}
                submitLabel={copy.submit}
                submittingLabel={copy.submitting}
                editing
              />
            </div>
          </details>
        </>
      ) : null}

      {payable.siblings.length > 0 ? (
        <section aria-label={copy.groupTitle} className="mb-6 max-w-xl">
          <h3 className="mb-3 text-lg heading">{copy.groupTitle}</h3>
          <PayableList
            payables={payable.siblings}
            hrefFor={(p) => `${base}/contas/${p.id}`}
            today={today}
          />
        </section>
      ) : null}

      {open && access.canEdit ? (
        <div className="mt-10 max-w-xl border-t pt-6">
          <PayableStatusButton
            mode="cancel"
            action={setPayableCancelled.bind(
              null,
              org.slug,
              project.id,
              payable.id,
              true,
            )}
          />
        </div>
      ) : null}
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="mb-6 max-w-xl rounded-2xl border bg-card p-4 md:p-5"
    >
      <h3 className="mb-2 text-lg heading">{title}</h3>
      {children}
    </section>
  );
}
