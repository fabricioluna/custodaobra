import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthScreen } from "@/components/layout/auth-screen";
import { OnboardingForm } from "@/features/organizations/components/onboarding-form";
import { organizationsCopy } from "@/features/organizations/copy";
import { getOnboardingData } from "@/features/organizations/queries";
import { AFTER_LOGIN_PATH } from "@/lib/auth/paths";
import { requireUserId } from "@/lib/auth/session";

const copy = organizationsCopy.onboarding;

export const metadata: Metadata = { title: copy.title };

export default function OnboardingPage() {
  return (
    <AuthScreen title={copy.title} description={copy.description}>
      <Suspense fallback={<div className="h-72" />}>
        <OnboardingContent />
      </Suspense>
    </AuthScreen>
  );
}

async function OnboardingContent() {
  const userId = await requireUserId();
  const data = await getOnboardingData(userId);
  if (!data || data.onboarded_at) redirect(AFTER_LOGIN_PATH);

  const fullName = data.full_name ?? "";
  // Quem entrou por e-mail não tem nome: a conta nasceu com o começo do
  // e-mail, que não serve de sugestão. Nesse caso, o campo começa vazio.
  const accountName = fullName ? (data.default_org?.name ?? fullName) : "";

  return (
    <OnboardingForm
      defaultFullName={fullName}
      defaultAccountName={accountName}
    />
  );
}
