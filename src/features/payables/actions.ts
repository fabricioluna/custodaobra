"use server";

import { redirect } from "next/navigation";

import { orgPath } from "@/components/layout/nav";
import { billingCopy } from "@/features/billing/copy";
import { requireOrg } from "@/features/organizations/queries";
import { getProjectAccess } from "@/features/projects/queries";
import { resolveSupplier } from "@/features/suppliers/resolve";
import { requireUserId } from "@/lib/auth/session";
import { canWrite } from "@/lib/billing/limits";
import { addDays, todayIn } from "@/lib/dates";
import { fieldErrorsFrom, type FormState, textField } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { payablesCopy } from "./copy";
import { splitInstallments } from "./installments";
import {
  type PayableFormField,
  payableFormSchema,
  type PayFormField,
  payFormSchema,
} from "./schemas";

export type PayableFormState = FormState<PayableFormField>;
export type PayFormState = FormState<PayFormField>;
export type PayableActionState = FormState<never>;

const { errors } = payablesCopy;

function parsePayableForm(formData: FormData) {
  return payableFormSchema.safeParse({
    description: textField(formData, "description"),
    amountCents: textField(formData, "amountCents"),
    dueDate: textField(formData, "dueDate"),
    installments: textField(formData, "installments"),
    stageId: textField(formData, "stageId"),
    categoryId: textField(formData, "categoryId"),
    supplierName: textField(formData, "supplierName"),
  });
}

/** Sessão, organização e permissão de editar a obra. */
async function authorize(orgSlug: string, projectId: string) {
  const userId = await requireUserId();
  const org = await requireOrg(orgSlug);
  const access = await getProjectAccess(org.id, projectId);
  return { userId, org, canEdit: access.canEdit };
}

const contasPath = (orgSlug: string, projectId: string, ...rest: string[]) =>
  orgPath(orgSlug, "obras", projectId, "contas", ...rest);

/**
 * Cadastra uma conta. Com mais de uma parcela, divide o valor total em
 * parcelas mensais, gravadas juntas (um insert só: ou entram todas, ou nenhuma).
 */
export async function createPayable(
  orgSlug: string,
  projectId: string,
  _prev: PayableFormState,
  formData: FormData,
): Promise<PayableFormState> {
  const { userId, org, canEdit } = await authorize(orgSlug, projectId);
  if (!canEdit) return { status: "error", message: errors.noPermission };

  const parsed = parsePayableForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const data = parsed.data;

  const supabase = await createClient();
  if (!(await canWrite(supabase, org.id)).ok) {
    return { status: "error", message: billingCopy.inactive };
  }
  const supplierId = await resolveSupplier(supabase, org.id, data.supplierName);
  const parts = splitInstallments(
    data.amountCents,
    data.installments,
    data.dueDate,
  );
  const groupId = parts.length > 1 ? crypto.randomUUID() : null;

  const { error } = await supabase.from("payables").insert(
    parts.map((part) => ({
      org_id: org.id,
      project_id: projectId,
      stage_id: data.stageId,
      category_id: data.categoryId,
      supplier_id: supplierId,
      description: data.description,
      amount_cents: part.amountCents,
      due_date: part.dueDate,
      installment_group_id: groupId,
      installment_number: groupId ? part.number : null,
      installment_total: groupId ? parts.length : null,
      created_by: userId,
    })),
  );
  if (error) {
    return {
      status: "error",
      message: error.code === "42501" ? errors.noPermission : errors.saveFailed,
    };
  }

  redirect(`${contasPath(org.slug, projectId)}?salvo=${parts.length}`);
}

/** Edita uma conta em aberto (só ela, mesmo que seja parcela de um grupo). */
export async function updatePayable(
  orgSlug: string,
  projectId: string,
  payableId: string,
  _prev: PayableFormState,
  formData: FormData,
): Promise<PayableFormState> {
  const { org, canEdit } = await authorize(orgSlug, projectId);
  if (!canEdit) return { status: "error", message: errors.noPermission };

  // A edição não tem campo de parcelas.
  formData.set("installments", "1");
  const parsed = parsePayableForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const data = parsed.data;

  // Editar continua liberado no bloqueio suave (só criar é bloqueado).
  const supabase = await createClient();
  const supplierId = await resolveSupplier(supabase, org.id, data.supplierName);
  const { data: updated, error } = await supabase
    .from("payables")
    .update({
      description: data.description,
      amount_cents: data.amountCents,
      due_date: data.dueDate,
      stage_id: data.stageId,
      category_id: data.categoryId,
      supplier_id: supplierId,
    })
    .eq("project_id", projectId)
    .eq("id", payableId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: errors.saveFailed };
  if (!updated) return { status: "error", message: errors.notOpen };

  redirect(contasPath(org.slug, projectId, payableId));
}

/**
 * Marca como paga: o banco cria o gasto confirmado e liga os dois numa
 * operação só (pay_payable). Volta para a lista com o aviso.
 */
export async function payPayable(
  orgSlug: string,
  projectId: string,
  payableId: string,
  _prev: PayFormState,
  formData: FormData,
): Promise<PayFormState> {
  const { org, canEdit } = await authorize(orgSlug, projectId);
  if (!canEdit) return { status: "error", message: errors.noPermission };

  const parsed = payFormSchema.safeParse({
    paidOn: textField(formData, "paidOn"),
    amountCents: textField(formData, "amountCents"),
    paymentMethod: textField(formData, "paymentMethod"),
    hasInvoice: textField(formData, "hasInvoice"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const data = parsed.data;
  // Mesma regra dos gastos: no máximo 1 dia no futuro.
  if (data.paidOn > addDays(todayIn(org.timezone), 1)) {
    return { status: "error", fieldErrors: { paidOn: errors.paidInFuture } };
  }

  const supabase = await createClient();
  // Pagar cria um gasto: segue o mesmo bloqueio suave.
  if (!(await canWrite(supabase, org.id)).ok) {
    return { status: "error", message: billingCopy.inactive };
  }
  const { data: expenseId, error } = await supabase.rpc("pay_payable", {
    p_payable_id: payableId,
    p_paid_on: data.paidOn,
    p_amount_cents: data.amountCents,
    p_payment_method: data.paymentMethod ?? undefined,
    p_has_invoice: data.hasInvoice,
  });
  if (error || !expenseId) {
    const message =
      error?.code === "P0001"
        ? errors.notOpen
        : error?.code === "P0002" || error?.code === "42501"
          ? errors.noPermission
          : errors.saveFailed;
    return { status: "error", message };
  }

  redirect(`${contasPath(org.slug, projectId)}?pago=${expenseId}`);
}

/** Cancela (ou reabre) uma conta. Nada é apagado: fica no histórico. */
export async function setPayableCancelled(
  orgSlug: string,
  projectId: string,
  payableId: string,
  cancelled: boolean,
): Promise<PayableActionState> {
  const { org, canEdit } = await authorize(orgSlug, projectId);
  if (!canEdit) return { status: "error", message: errors.noPermission };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payables")
    .update({ status: cancelled ? "cancelled" : "open" })
    .eq("project_id", projectId)
    .eq("id", payableId)
    .eq("status", cancelled ? "open" : "cancelled")
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: errors.saveFailed };
  if (!data) return { status: "error", message: errors.notOpen };

  redirect(
    cancelled
      ? contasPath(org.slug, projectId)
      : contasPath(org.slug, projectId, payableId),
  );
}
