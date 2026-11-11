import { type ReactNode, Suspense } from "react";

import { AppNav } from "@/components/layout/app-nav";
import { AppShell } from "@/components/layout/app-shell";
import { BillingBanner } from "@/features/billing/components/billing-banner";
import { getLaunchAccess } from "@/features/members/queries";
import { requireOrg } from "@/features/organizations/queries";

// A moldura (cabeçalho e navegação) fica pré-renderizada. Só o conteúdo
// espera a checagem de acesso, que lê a sessão (cacheComponents).
export default function OrgLayout({
  children,
  params,
}: LayoutProps<"/o/[orgSlug]">) {
  return (
    <AppShell nav={<OrgNav params={params} />}>
      <Suspense fallback={<ContentFallback />}>
        <OrgGate params={params}>{children}</OrgGate>
      </Suspense>
    </AppShell>
  );
}

/**
 * Mostra "página não encontrada" se a pessoa não for membro da organização.
 * Atenção: isto é experiência, não segurança. Layout e página rodam em
 * paralelo, então toda página que busca dados chama requireOrg() de novo,
 * e o RLS protege os dados no banco.
 */
async function OrgGate({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: ReactNode;
}) {
  const { orgSlug } = await params;
  const org = await requireOrg(orgSlug);
  return (
    <>
      <BillingBanner orgId={org.id} orgSlug={org.slug} />
      {children}
    </>
  );
}

/** Navegação com a tecla "Lançar gasto" só para quem pode lançar. */
async function OrgNav({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const access = await getLaunchAccess(orgSlug);
  return <AppNav access={access} />;
}

function ContentFallback() {
  return (
    <div aria-hidden className="animate-pulse motion-reduce:animate-none">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="mt-3 h-5 w-72 max-w-full rounded-lg bg-muted" />
    </div>
  );
}
