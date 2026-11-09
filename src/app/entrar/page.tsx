import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthScreen } from "@/components/layout/auth-screen";
import { LoginPanel } from "@/features/auth/components/login-panel";
import { authCopy } from "@/features/auth/copy";

const copy = authCopy.login;

export const metadata: Metadata = { title: copy.title };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function LoginPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <AuthScreen title={copy.title} description={copy.description}>
      <Suspense fallback={<div className="h-80" />}>
        <LoginPanelFromUrl searchParams={searchParams} />
      </Suspense>
    </AuthScreen>
  );
}

/** Lê ?next= e ?erro= no servidor; o painel já chega pronto no HTML. */
async function LoginPanelFromUrl({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? null;
  return (
    <LoginPanel
      next={first(params.next) ?? ""}
      errorCode={first(params.erro)}
    />
  );
}
