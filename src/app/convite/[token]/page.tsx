import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthScreen } from "@/components/layout/auth-screen";
import { FormMessage } from "@/components/form-message";
import { buttonVariants } from "@/components/ui/button";
import { acceptInvitation } from "@/features/members/actions";
import { AcceptInviteForm } from "@/features/members/components/accept-invite-form";
import { membersCopy } from "@/features/members/copy";
import { getInvitation } from "@/features/members/queries";
import { AFTER_LOGIN_PATH, loginPathFor } from "@/lib/auth/paths";
import { getUserId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const copy = membersCopy.accept;

export const metadata: Metadata = {
  title: copy.title,
  // O link carrega o token: não deve ir para buscadores nem vazar no Referer.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function InvitationPage({
  params,
}: PageProps<"/convite/[token]">) {
  return (
    <Suspense
      fallback={
        <AuthScreen title={copy.title}>
          <div className="h-40" />
        </AuthScreen>
      }
    >
      <InvitationContent params={params} />
    </Suspense>
  );
}

async function InvitationContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getInvitation(token);

  if (!invitation) {
    return (
      <AuthScreen title={copy.invalidTitle}>
        <FormMessage>{copy.invalid}</FormMessage>
      </AuthScreen>
    );
  }

  const heading = copy.heading(invitation.inviterName, invitation.orgName);
  const description =
    invitation.projectName && invitation.projectRole
      ? copy.toProject(
          invitation.projectName,
          membersCopy.roles[invitation.projectRole],
        )
      : copy.toAll(invitation.orgName);

  if (invitation.status !== "pending") {
    const message =
      invitation.status === "expired"
        ? copy.expired
        : invitation.status === "revoked"
          ? copy.revoked
          : copy.used;
    return (
      <AuthScreen title={heading} description={description}>
        <div className="flex flex-col gap-5">
          <FormMessage>{message}</FormMessage>
          <Link
            href={AFTER_LOGIN_PATH}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "rounded-xl",
            )}
          >
            {copy.open}
          </Link>
        </div>
      </AuthScreen>
    );
  }

  const userId = await getUserId();
  if (!userId) {
    return (
      <AuthScreen title={heading} description={description}>
        <div className="flex flex-col gap-5">
          <p className="text-muted-foreground">{copy.signInHint}</p>
          <Link
            href={loginPathFor(`/convite/${token}`)}
            className={cn(
              buttonVariants({ variant: "action", size: "lg" }),
              "h-13 w-full rounded-xl text-base",
            )}
          >
            {copy.signIn}
          </Link>
        </div>
      </AuthScreen>
    );
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, onboarded_at")
    .eq("id", userId)
    .maybeSingle();

  return (
    <AuthScreen title={heading} description={description}>
      <AcceptInviteForm
        action={acceptInvitation.bind(null, token)}
        askName={!profile?.onboarded_at}
        defaultName={profile?.full_name ?? ""}
      />
    </AuthScreen>
  );
}
