"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useActionState } from "react";

import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";

import type { ProjectFormState } from "../actions";
import { projectsCopy } from "../copy";

const copy = projectsCopy.edit;

export function ArchiveProjectButton({
  action,
  archived,
}: {
  action: () => Promise<ProjectFormState>;
  archived: boolean;
}) {
  const [state, formAction, pending] = useActionState<ProjectFormState>(
    action,
    { status: "idle" },
  );
  return (
    <form action={formAction} className="flex flex-col items-start gap-3">
      {state.status === "error" && state.message ? (
        <FormMessage>{state.message}</FormMessage>
      ) : null}
      <Button
        type="submit"
        variant="outline"
        size="lg"
        disabled={pending}
        className="rounded-xl"
      >
        {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
        {archived ? copy.unarchive : copy.archive}
      </Button>
    </form>
  );
}
