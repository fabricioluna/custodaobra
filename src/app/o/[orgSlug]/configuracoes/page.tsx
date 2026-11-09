import {
  ChevronRight,
  LogOut,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { orgPath } from "@/components/layout/nav";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";
import { authCopy } from "@/features/auth/copy";
import { membersCopy } from "@/features/members/copy";
import {
  getOrgRole,
  isOrgAdminRole,
  listMyOrgs,
  listTeam,
} from "@/features/members/queries";
import { requireOrg } from "@/features/organizations/queries";
import { settingsCopy as copy } from "@/features/settings/copy";
import { whatsappCopy } from "@/features/whatsapp/copy";
import { getMyWhatsapp } from "@/features/whatsapp/queries";
import { formatPhone } from "@/lib/whatsapp/phone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: copy.title };

const rowClass =
  "flex min-h-16 items-center gap-4 rounded-2xl border bg-card p-4 outline-none hover:border-input focus-visible:ring-3 focus-visible:ring-ring/40";

export default async function SettingsPage({
  params,
}: PageProps<"/o/[orgSlug]/configuracoes">) {
  const { orgSlug } = await params;
  const org = await requireOrg(orgSlug);
  const [role, orgs, whatsapp] = await Promise.all([
    getOrgRole(org.id),
    listMyOrgs(),
    getMyWhatsapp(),
  ]);
  const canManage = isOrgAdminRole(role);
  const team = canManage ? await listTeam(org.id) : [];

  return (
    <>
      <PageHeader title={copy.title} description={org.name} />

      <div className="flex max-w-xl flex-col gap-8">
        <section>
          <h2 className="mb-3 text-lg heading">{whatsappCopy.title}</h2>
          <Link
            href={orgPath(org.slug, "configuracoes", "whatsapp")}
            className={rowClass}
          >
            <MessageCircle
              className="size-6 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="flex flex-1 flex-col">
              <span className="font-semibold">
                {whatsapp.phone
                  ? whatsappCopy.connectedTitle
                  : whatsappCopy.disconnectedTitle}
              </span>
              <span className="text-sm text-muted-foreground">
                {whatsapp.phone
                  ? whatsappCopy.rowConnected(formatPhone(whatsapp.phone))
                  : whatsappCopy.rowDisconnected}
              </span>
            </span>
            <ChevronRight
              className="size-5 text-muted-foreground"
              aria-hidden
            />
          </Link>
        </section>

        {canManage ? (
          <section>
            <h2 className="mb-3 text-lg heading">{copy.team}</h2>
            <Link
              href={orgPath(org.slug, "configuracoes", "equipe")}
              className={rowClass}
            >
              <Users
                className="size-6 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="flex flex-1 flex-col">
                <span className="font-semibold">{membersCopy.team.title}</span>
                <span className="text-sm text-muted-foreground">
                  {copy.teamDescription(team.length)}
                </span>
              </span>
              <ChevronRight
                className="size-5 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </section>
        ) : null}

        {orgs.length > 1 ? (
          <section>
            <h2 className="text-lg heading">{copy.accountsTitle}</h2>
            <p className="mt-1 mb-3 text-sm text-muted-foreground">
              {copy.accountsDescription}
            </p>
            <ul className="flex flex-col gap-2">
              {orgs.map((item) => {
                const current = item.id === org.id;
                return (
                  <li key={item.id}>
                    <Link
                      href={orgPath(item.slug, "obras")}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        rowClass,
                        "min-h-14",
                        current && "border-primary",
                      )}
                    >
                      <span className="flex flex-1 flex-col">
                        <span className="font-semibold">
                          {item.name}
                          {current ? (
                            <span className="font-normal text-muted-foreground">
                              {` (${copy.current})`}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {membersCopy.roles[item.role]}
                        </span>
                      </span>
                      <ChevronRight
                        className="size-5 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <EmptyState
          icon={Settings}
          title={copy.comingSoonTitle}
          description={copy.comingSoonDescription}
        />
      </div>

      <form action={signOut} className="mt-10 border-t pt-6">
        <Button type="submit" variant="outline" size="lg">
          <LogOut aria-hidden />
          {authCopy.signOut}
        </Button>
      </form>
    </>
  );
}
