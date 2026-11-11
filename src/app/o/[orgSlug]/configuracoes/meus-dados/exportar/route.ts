import { buildAccountExport } from "@/features/account/export";
import { accountCopy } from "@/features/account/copy";
import { getOrgBySlug } from "@/features/organizations/queries";
import { todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

/**
 * Planilha com todos os dados que a pessoa vê, em todas as contas dela
 * (portabilidade, LGPD). O RLS decide o que entra.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/o/[orgSlug]/configuracoes/meus-dados/exportar">,
) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) return new Response("Não encontrado", { status: 404 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return new Response("Não autorizado", { status: 401 });

  const xlsx = await buildAccountExport(supabase, {
    id: data.user.id,
    email: data.user.email ?? null,
  });
  const fileName = accountCopy.export.fileName(todayIn(org.timezone));
  return new Response(new Uint8Array(xlsx), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
