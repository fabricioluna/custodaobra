import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthScreen } from "@/components/layout/auth-screen";
import { NewPasswordForm } from "@/features/auth/components/new-password-form";
import { authCopy } from "@/features/auth/copy";
import { AFTER_LOGIN_PATH } from "@/lib/auth/paths";
import { requireUserId } from "@/lib/auth/session";

const copy = authCopy.newPassword;

export const metadata: Metadata = { title: copy.title };

/**
 * Aberta pelo link do e-mail de "Esqueci minha senha": o link já abriu a
 * sessão (/auth/confirm), aqui a pessoa só escolhe a senha.
 */
export default function NewPasswordPage() {
  return (
    <AuthScreen title={copy.title} description={copy.description}>
      <Suspense fallback={<div className="h-56" />}>
        <NewPasswordContent />
      </Suspense>
    </AuthScreen>
  );
}

async function NewPasswordContent() {
  await requireUserId();
  return <NewPasswordForm continueTo={AFTER_LOGIN_PATH} />;
}
