import { Unlink } from "lucide-react";
import type { Metadata } from "next";

import { BackLink } from "@/components/layout/back-link";
import { orgPath } from "@/components/layout/nav";
import { PageHeader } from "@/components/layout/page-header";
import { ActionButton } from "@/features/members/components/action-button";
import { requireOrg } from "@/features/organizations/queries";
import {
  createLinkCode,
  refreshWhatsapp,
  unlinkWhatsapp,
} from "@/features/whatsapp/actions";
import { ConnectWhatsapp } from "@/features/whatsapp/components/connect-whatsapp";
import { whatsappCopy as copy } from "@/features/whatsapp/copy";
import { botNumber, getMyWhatsapp } from "@/features/whatsapp/queries";
import { formatDate, todayIn } from "@/lib/dates";
import { formatPhone } from "@/lib/whatsapp/phone";

export const metadata: Metadata = { title: copy.title };

/** O número é da pessoa (perfil), não da conta: vale para todas as contas dela. */
export default async function WhatsappSettingsPage({
  params,
}: PageProps<"/o/[orgSlug]/configuracoes/whatsapp">) {
  const { orgSlug } = await params;
  const org = await requireOrg(orgSlug);
  const { phone, linkedAt } = await getMyWhatsapp();
  const bot = botNumber();
  const botLabel = bot ? formatPhone(bot) : null;

  return (
    <>
      <BackLink href={orgPath(org.slug, "configuracoes")} label={copy.back} />
      <PageHeader title={copy.title} description={copy.description} />

      <div className="flex max-w-xl flex-col gap-8">
        {phone ? (
          <>
            <section>
              <h2 className="text-lg heading">{copy.connectedTitle}</h2>
              <p className="mt-1.5 text-muted-foreground">
                {linkedAt
                  ? copy.connectedSince(
                      formatPhone(phone),
                      formatDate(todayIn(org.timezone, new Date(linkedAt))),
                    )
                  : formatPhone(phone)}
              </p>
            </section>
            <ConnectWhatsapp
              createCode={createLinkCode}
              refresh={refreshWhatsapp}
              botLabel={botLabel}
              label={copy.changeNumber}
              variant="outline"
            />
            <ActionButton
              action={unlinkWhatsapp}
              label={copy.disconnect}
              pendingLabel={copy.disconnecting}
              confirmMessage={copy.disconnectConfirm}
              icon={<Unlink aria-hidden />}
              variant="ghost"
              className="border-t pt-6"
            />
          </>
        ) : (
          <>
            <section>
              <h2 className="text-lg heading">{copy.disconnectedTitle}</h2>
              <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
                {copy.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
            <ConnectWhatsapp
              createCode={createLinkCode}
              refresh={refreshWhatsapp}
              botLabel={botLabel}
            />
          </>
        )}
      </div>
    </>
  );
}
