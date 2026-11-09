import type { Metadata } from "next";

import { FormMessage } from "@/components/form-message";
import { getExpenseFormOptions } from "@/features/expenses/queries";
import { createPayable } from "@/features/payables/actions";
import { PayableForm } from "@/features/payables/components/payable-form";
import { payablesCopy } from "@/features/payables/copy";
import { requireProject } from "@/features/projects/queries";
import { todayIn } from "@/lib/dates";

const copy = payablesCopy.create;

export const metadata: Metadata = { title: copy.title };

export default async function NewPayablePage({
  params,
}: PageProps<"/o/[orgSlug]/obras/[projectId]/contas/nova">) {
  const { orgSlug, projectId } = await params;
  const { org, project, access } = await requireProject(orgSlug, projectId);
  if (!access.canEdit) return <FormMessage>{copy.noPermission}</FormMessage>;

  const options = await getExpenseFormOptions(org.id, project.id);
  const material = options.categories.find((c) => c.code === "material");

  return (
    <>
      <h2 className="mb-5 text-xl heading">{copy.title}</h2>
      <PayableForm
        action={createPayable.bind(null, org.slug, project.id)}
        options={options}
        defaults={{
          description: "",
          amountCents: 0,
          dueDate: todayIn(org.timezone),
          stageId: "",
          categoryId: material?.id ?? options.categories[0]?.id ?? "",
          supplierName: "",
        }}
        submitLabel={copy.submit}
        submittingLabel={copy.submitting}
      />
    </>
  );
}
