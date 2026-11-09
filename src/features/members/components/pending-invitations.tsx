import { Clock, X } from "lucide-react";

import { formatDate, todayIn } from "@/lib/dates";

import { cancelInvitation } from "../actions";
import { membersCopy } from "../copy";
import type { PendingInvitation } from "../queries";
import { ActionButton } from "./action-button";

const copy = membersCopy.team;
const { roles } = membersCopy;

/** Convites que ainda valem, com o botão de cancelar. */
export function PendingInvitations({
  orgSlug,
  timezone,
  invitations,
}: {
  orgSlug: string;
  timezone: string;
  invitations: PendingInvitation[];
}) {
  if (!invitations.length) {
    return <p className="text-muted-foreground">{copy.pendingEmpty}</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {invitations.map((invitation) => {
        const access =
          invitation.project_id && invitation.project_role
            ? `${invitation.projects?.name ?? ""} (${roles[invitation.project_role].toLowerCase()})`
            : copy.accountWide;
        const expires = formatDate(
          todayIn(timezone, new Date(invitation.expires_at)),
        );
        return (
          <li
            key={invitation.id}
            className="flex flex-col gap-3 rounded-2xl border border-dashed bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 gap-3">
              <Clock
                className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold">
                  {invitation.label ?? access}
                </span>
                {invitation.label ? (
                  <span className="text-sm text-muted-foreground">
                    {access}
                  </span>
                ) : null}
                <span className="text-sm text-muted-foreground">
                  {copy.expiresOn(expires)}
                </span>
              </div>
            </div>
            <ActionButton
              action={cancelInvitation.bind(null, orgSlug, invitation.id)}
              label={copy.cancel}
              pendingLabel={copy.cancelling}
              icon={<X aria-hidden />}
              variant="ghost"
            />
          </li>
        );
      })}
    </ul>
  );
}
