"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { orgPath } from "@/components/layout/nav";
import { billingCopy } from "@/features/billing/copy";
import { requireOrg } from "@/features/organizations/queries";
import { getProjectAccess } from "@/features/projects/queries";
import { findOrCreateStage } from "@/features/stages/create";
import { resolveSupplier } from "@/features/suppliers/resolve";
import { requireUserId } from "@/lib/auth/session";
import { canWrite } from "@/lib/billing/limits";
import { addDays, todayIn } from "@/lib/dates";
import { fieldErrorsFrom, type FormState, textField } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { expensesCopy } from "./copy";
import {
  type ExpenseFormData,
  type ExpenseFormField,
  expenseFormSchema,
  MAX_RECEIPT_BYTES,
  NEW_STAGE,
  RECEIPT_MIME_TYPES,
} from "./schemas";

export type ExpenseFormState = FormState<ExpenseFormField>;

type Client = SupabaseClient<Database>;

const { errors } = expensesCopy;

function parseExpenseForm(formData: FormData) {
  return expenseFormSchema.safeParse({
    amountCents: textField(formData, "amountCents"),
    description: textField(formData, "description"),
    stageId: textField(formData, "stageId"),
    newStageName: textField(formData, "newStageName"),
    categoryId: textField(formData, "categoryId"),
    spentOn: textField(formData, "spentOn"),
    supplierName: textField(formData, "supplierName"),
    paymentMethod: textField(formData, "paymentMethod"),
    hasInvoice: textField(formData, "hasInvoice"),
    invoiceNumber: textField(formData, "invoiceNumber"),
    quantity: textField(formData, "quantity"),
    unit: textField(formData, "unit"),
    unitPriceCents: textField(formData, "unitPriceCents"),
  });
}

/** Arquivo do comprovante, se veio algum. */
function receiptFile(formData: FormData): File | null {
  const value = formData.get("receipt");
  return value instanceof File && value.size > 0 ? value : null;
}

function validateReceipt(file: File | null): string | null {
  if (!file) return null;
  if (!(RECEIPT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return errors.receiptType;
  }
  if (file.size > MAX_RECEIPT_BYTES) return errors.receiptTooBig;
  return null;
}

/** Categoria escolhida, para usar o nome dela como descrição padrão. */
async function getCategoryName(supabase: Client, categoryId: string) {
  const { data } = await supabase
    .from("categories")
    .select("name")
    .eq("id", categoryId)
    .maybeSingle();
  return data?.name ?? null;
}

async function uploadReceipt(
  supabase: Client,
  {
    orgId,
    expenseId,
    userId,
    file,
  }: { orgId: string; expenseId: string; userId: string; file: File },
): Promise<boolean> {
  const extension =
    file.type === "application/pdf"
      ? "pdf"
      : (file.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
  const path = `${orgId}/${expenseId}/${crypto.randomUUID()}.${extension}`;

  const upload = await supabase.storage
    .from("comprovantes")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) return false;

  const { error } = await supabase.from("attachments").insert({
    org_id: orgId,
    expense_id: expenseId,
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: userId,
  });
  if (error) {
    await supabase.storage.from("comprovantes").remove([path]);
    return false;
  }
  return true;
}

/** Validações que dependem do contexto (fuso da organização). */
function checkDate(data: ExpenseFormData, timezone: string) {
  // Não pode ser futura além de 1 dia (CLAUDE.md, seção 7).
  const limit = addDays(todayIn(timezone), 1);
  return data.spentOn > limit ? errors.dateInFuture : null;
}

async function prepare(
  orgSlug: string,
  projectId: string,
  formData: FormData,
  { creating }: { creating: boolean },
) {
  // Leituras independentes juntas, em poucas rodadas ao banco: lançar um
  // gasto precisa ser rápido. Nada é gravado (nem fornecedor novo) antes de
  // conferir a permissão e o plano.
  const parsed = parseExpenseForm(formData);
  const [userId, org, supabase] = await Promise.all([
    requireUserId(),
    requireOrg(orgSlug),
    createClient(),
  ]);
  const [access, allowed, categoryName] = await Promise.all([
    getProjectAccess(org.id, projectId),
    // Bloqueio suave: sem plano em vigor, não lança gasto novo (editar pode).
    creating ? canWrite(supabase, org.id) : null,
    parsed.success && !parsed.data.description
      ? getCategoryName(supabase, parsed.data.categoryId)
      : null,
  ]);
  if (!access.canEdit) {
    return {
      ok: false,
      state: { status: "error", message: errors.noPermission },
    } as const;
  }

  if (!parsed.success) {
    return {
      ok: false,
      state: { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) },
    } as const;
  }
  const dateError = checkDate(parsed.data, org.timezone);
  if (dateError) {
    return {
      ok: false,
      state: { status: "error", fieldErrors: { spentOn: dateError } },
    } as const;
  }

  const file = receiptFile(formData);
  const receiptError = validateReceipt(file);
  if (receiptError) {
    return {
      ok: false,
      state: { status: "error", fieldErrors: { receipt: receiptError } },
    } as const;
  }

  if (allowed && !allowed.ok) {
    return {
      ok: false,
      state: {
        status: "error",
        message: billingCopy.blocked(allowed.reason),
      },
    } as const;
  }
  const data = parsed.data;
  // "+ Nova etapa": cria (ou reaproveita, se já existe com esse nome) junto
  // com o fornecedor, depois de conferir permissão e plano.
  const [supplierId, newStage] = await Promise.all([
    resolveSupplier(supabase, org.id, data.supplierName),
    data.stageId === NEW_STAGE && data.newStageName
      ? findOrCreateStage(supabase, org.id, projectId, data.newStageName)
      : null,
  ]);
  if (data.stageId === NEW_STAGE && !newStage) {
    return {
      ok: false,
      state: {
        status: "error",
        fieldErrors: { newStageName: errors.newStageFailed },
      },
    } as const;
  }

  const row = {
    stage_id: newStage ? newStage.id : data.stageId,
    category_id: data.categoryId,
    supplier_id: supplierId,
    description: data.description ?? categoryName ?? "Gasto",
    amount_cents: data.amountCents,
    quantity: data.quantity,
    unit: data.unit,
    unit_price_cents: data.unitPriceCents,
    spent_on: data.spentOn,
    payment_method: data.paymentMethod,
    has_invoice: data.hasInvoice,
    invoice_number: data.invoiceNumber,
  };

  return { ok: true, userId, org, supabase, file, row } as const;
}

/**
 * Lança um gasto pelo app (já confirmado: foi a própria pessoa que digitou) e
 * volta para o painel da obra, que mostra o lançamento na hora.
 */
export async function createExpense(
  orgSlug: string,
  projectId: string,
  _prev: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const ready = await prepare(orgSlug, projectId, formData, { creating: true });
  if (!ready.ok) return ready.state;
  const { userId, org, supabase, file, row } = ready;

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      ...row,
      org_id: org.id,
      project_id: projectId,
      status: "confirmed",
      source: "app",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      status: "error",
      message:
        error?.code === "42501" ? errors.noPermission : errors.saveFailed,
    };
  }

  let receiptOk = true;
  if (file) {
    receiptOk = await uploadReceipt(supabase, {
      orgId: org.id,
      expenseId: data.id,
      userId,
      file,
    });
  }

  const params = new URLSearchParams({ lancado: data.id });
  if (!receiptOk) params.set("aviso", "comprovante");
  redirect(`${orgPath(org.slug, "obras", projectId)}?${params.toString()}`);
}

export async function updateExpense(
  orgSlug: string,
  projectId: string,
  expenseId: string,
  _prev: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const ready = await prepare(orgSlug, projectId, formData, {
    creating: false,
  });
  if (!ready.ok) return ready.state;
  const { userId, org, supabase, file, row } = ready;

  const { data, error } = await supabase
    .from("expenses")
    .update(row)
    .eq("project_id", projectId)
    .eq("id", expenseId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) return { status: "error", message: errors.saveFailed };

  if (file) {
    const ok = await uploadReceipt(supabase, {
      orgId: org.id,
      expenseId,
      userId,
      file,
    });
    if (!ok) return { status: "error", message: errors.receiptFailed };
  }

  redirect(orgPath(org.slug, "obras", projectId, "lancamentos"));
}

/** Exclusão lógica: o gasto sai dos totais, mas fica no registro. */
export async function deleteExpense(
  orgSlug: string,
  projectId: string,
  expenseId: string,
): Promise<ExpenseFormState> {
  await requireUserId();
  const org = await requireOrg(orgSlug);
  const access = await getProjectAccess(org.id, projectId);
  if (!access.canEdit) return { status: "error", message: errors.noPermission };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("id", expenseId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) return { status: "error", message: errors.saveFailed };

  redirect(orgPath(org.slug, "obras", projectId, "lancamentos"));
}
