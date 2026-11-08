import { AppShell } from "@/components/layout/app-shell";

// Não lê `params` aqui de propósito: a navegação lê o slug dentro de <Suspense>,
// e assim a moldura da página continua pré-renderizada (cacheComponents).
export default function OrgLayout({ children }: LayoutProps<"/o/[orgSlug]">) {
  return <AppShell>{children}</AppShell>;
}
