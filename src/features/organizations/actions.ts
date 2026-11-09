"use server";

import { redirect } from "next/navigation";

import { orgPath } from "@/components/layout/nav";
import { requireUserId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { organizationsCopy } from "./copy";
import { type OnboardingInput, onboardingSchema } from "./schemas";

export type OnboardingState =
  | { status: "idle" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<keyof OnboardingInput, string>>;
    };

/**
 * Conclui o primeiro acesso: grava o nome da pessoa e o nome da conta, e leva
 * para a criação da primeira obra.
 * TODO(Fase 1): registrar em audit_log quando a tabela existir.
 */
export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const userId = await requireUserId();

  const parsed = onboardingSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    accountName: formData.get("accountName") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof OnboardingInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof OnboardingInput;
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", fieldErrors };
  }

  const supabase = await createClient();
  const failed: OnboardingState = {
    status: "error",
    message: organizationsCopy.errors.saveFailed,
  };

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_org_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.default_org_id) return failed;

  // RLS: só o dono (ou admin) consegue renomear a organização.
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .update({ name: parsed.data.accountName })
    .eq("id", profile.default_org_id)
    .select("slug")
    .maybeSingle();
  if (orgError || !org) return failed;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (profileError) return failed;

  redirect(orgPath(org.slug, "obras", "nova"));
}
