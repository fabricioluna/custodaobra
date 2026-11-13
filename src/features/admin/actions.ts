"use server";

import { redirect } from "next/navigation";

import {
  type FormState,
  fieldErrorsFrom,
  isUuid,
  textField,
} from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { accessFormSchema, accessOverrideAt } from "./access";
import { adminCopy } from "./copy";

const errors = adminCopy.access.errors;

export type AccessField = "mode" | "date" | "note" | "planCode";
export type AccessFormState = FormState<AccessField>;

/**
 * Libera, bloqueia ou devolve à regra normal uma conta (e, se pedido, troca o
 * plano). Só a equipe: a função do banco confere platform_admins.
 */
export async function setOrgAccess(
  orgId: string,
  _prev: AccessFormState,
  formData: FormData,
): Promise<AccessFormState> {
  if (!isUuid(orgId)) return { status: "error", message: errors.failed };
  const parsed = accessFormSchema.safeParse({
    mode: textField(formData, "mode"),
    date: textField(formData, "date"),
    note: textField(formData, "note"),
    planCode: textField(formData, "planCode"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const { mode, date, note, planCode } = parsed.data;

  const supabase = await createClient();
  // A função do banco confere platform_admins; aqui, ao menos a sessão.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: errors.noPermission };

  const at = accessOverrideAt(mode, date);
  const { error } = await supabase.rpc("admin_set_access", {
    p_org_id: orgId,
    p_mode: mode === "normal" ? undefined : mode,
    p_at: at ?? undefined,
    p_note: note || undefined,
    p_plan_code: planCode || undefined,
  });
  if (error) {
    if (error.code === "42501") {
      return { status: "error", message: errors.noPermission };
    }
    if (error.code === "22023") {
      return { status: "error", fieldErrors: { planCode: errors.plan } };
    }
    console.error("[admin] acesso da conta", orgId, error);
    return { status: "error", message: errors.failed };
  }
  redirect("/admin");
}
