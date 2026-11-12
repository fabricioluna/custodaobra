import { Download } from "lucide-react";
import type { Metadata } from "next";

import { BackLink } from "@/components/layout/back-link";
import { orgPath } from "@/components/layout/nav";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { DeleteAccountForm } from "@/features/account/components/delete-account-form";
import { accountCopy as copy } from "@/features/account/copy";
import { getDeletionPreview } from "@/features/account/queries";
import { requireOrg } from "@/features/organizations/queries";
import { settingsCopy } from "@/features/settings/copy";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: copy.page.title };

/** Portabilidade e exclusão (LGPD). Vale para a pessoa, não só esta conta. */
export default async function MyDataPage({
  params,
}: PageProps<"/o/[orgSlug]/configuracoes/meus-dados">) {
  const { orgSlug } = await params;
  const org = await requireOrg(orgSlug);
  const preview = await getDeletionPreview();

  return (
    <>
      <BackLink
        href={orgPath(org.slug, "configuracoes")}
        label={settingsCopy.title}
      />
      <PageHeader title={copy.page.title} description={copy.page.description} />

      <div className="flex max-w-xl flex-col gap-10">
        <section>
          <h2 className="text-lg heading">{copy.exportSection.title}</h2>
          <p className="mt-1.5 mb-4 text-muted-foreground">
            {copy.exportSection.description}
          </p>
          <a
            href={orgPath(org.slug, "configuracoes", "meus-dados", "exportar")}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            download
          >
            <Download aria-hidden />
            {copy.exportSection.button}
          </a>
        </section>

        <section className="rounded-2xl border border-status-danger/40 p-5">
          <h2 className="text-lg heading text-status-danger">
            {copy.deleteSection.title}
          </h2>
          <p className="mt-1.5 text-muted-foreground">
            {copy.deleteSection.description}
          </p>
          {preview.ownedOrgs.length ? (
            <div className="mt-4">
              <p className="font-semibold">{copy.deleteSection.ownedTitle}</p>
              <ul className="mt-2 list-disc pl-5">
                {preview.ownedOrgs.map((item) => (
                  <li key={item.id}>
                    {copy.deleteSection.owned(
                      item.name,
                      item.projects,
                      item.otherPeople,
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {preview.memberOfOthers ? (
            <p className="mt-4 text-muted-foreground">
              {copy.deleteSection.memberNote}
            </p>
          ) : null}
          <p className="mt-4 mb-5 text-muted-foreground">
            {copy.deleteSection.exportFirst}
          </p>
          <DeleteAccountForm />
        </section>
      </div>
    </>
  );
}
