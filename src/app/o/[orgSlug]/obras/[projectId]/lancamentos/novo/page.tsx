import type { Metadata } from "next";

import { FormMessage } from "@/components/form-message";
import { createExpense } from "@/features/expenses/actions";
import { ExpenseForm } from "@/features/expenses/components/expense-form";
import { expensesCopy } from "@/features/expenses/copy";
import { getExpenseFormOptions } from "@/features/expenses/queries";
import { requireProject } from "@/features/projects/queries";
import { todayIn } from "@/lib/dates";

const copy = expensesCopy.create;

export const metadata: Metadata = { title: copy.title };

export default async function NewProjectExpensePage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/obras/[projectId]/lancamentos/novo">) {
  const { orgSlug, projectId } = await params;
  const { org, project, access } = await requireProject(orgSlug, projectId);
  if (!access.canEdit) {
    return <FormMessage>{expensesCopy.errors.noPermission}</FormMessage>;
  }

  const query = await searchParams;
  const options = await getExpenseFormOptions(org.id, project.id);
  const material = options.categories.find((c) => c.code === "material");
  const stageFromUrl =
    typeof query.etapa === "string" &&
    options.stages.some((stage) => stage.id === query.etapa)
      ? query.etapa
      : "";

  return (
    <>
      <h2 className="mb-5 text-xl heading">{copy.title}</h2>
      <ExpenseForm
        action={createExpense.bind(null, org.slug, project.id)}
        options={options}
        defaults={{
          amountCents: 0,
          description: "",
          stageId: stageFromUrl,
          categoryId: material?.id ?? options.categories[0]?.id ?? "",
          spentOn: todayIn(org.timezone),
          supplierName: "",
          paymentMethod: "",
          hasInvoice: false,
          invoiceNumber: "",
          quantity: "",
          unit: "",
          unitPriceCents: 0,
        }}
        submitLabel={copy.submit}
        submittingLabel={copy.submitting}
      />
    </>
  );
}
