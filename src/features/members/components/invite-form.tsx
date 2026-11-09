"use client";

import { Check, Copy, Link2, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { FormField, fieldA11y } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { APP_NAME } from "@/config/app";
import { cn } from "@/lib/utils";

import type { InviteFormState } from "../actions";
import { membersCopy } from "../copy";
import { Choice } from "./choice";

const copy = membersCopy.invite;
const { roles, roleHints } = membersCopy;

/**
 * Convite em um passo: acesso (uma obra ou todas), papel na obra e um apelido
 * opcional. Depois de gerado, o link aparece uma única vez, com copiar e
 * mandar pelo WhatsApp.
 */
type InviteFormProps = {
  action: (
    state: InviteFormState,
    formData: FormData,
  ) => Promise<InviteFormState>;
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
  teamHref: string;
};

export function InviteForm(props: InviteFormProps) {
  // Convidar outra pessoa: um formulário novo (key) zera o estado da action.
  const [round, setRound] = useState(0);
  return (
    <InviteFormRound
      key={round}
      {...props}
      onAnother={() => setRound((n) => n + 1)}
    />
  );
}

function InviteFormRound({
  action,
  projects,
  defaultProjectId,
  teamHref,
  onAnother,
}: InviteFormProps & { onAnother: () => void }) {
  const [state, formAction, pending] = useActionState<
    InviteFormState,
    FormData
  >(action, { status: "idle" });
  const [scope, setScope] = useState<"project" | "all">(
    projects.length ? "project" : "all",
  );
  if (state.status === "success") {
    return (
      <InviteLink link={state.link} teamHref={teamHref} onAnother={onAnother} />
    );
  }

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-6"
      noValidate
    >
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-base font-semibold">{copy.scope}</legend>
        <Choice
          name="scope"
          value="project"
          checked={scope === "project"}
          onChange={() => setScope("project")}
          title={copy.scopeProject}
          hint={copy.scopeProjectHint}
        />
        <Choice
          name="scope"
          value="all"
          checked={scope === "all"}
          onChange={() => setScope("all")}
          title={copy.scopeAll}
          hint={copy.scopeAllHint}
        />
      </fieldset>

      {scope === "project" ? (
        projects.length ? (
          <>
            <FormField
              id="projectId"
              label={copy.project}
              error={fieldErrors?.projectId}
            >
              <NativeSelect
                name="projectId"
                defaultValue={defaultProjectId ?? projects[0]?.id}
                {...fieldA11y("projectId", undefined, fieldErrors?.projectId)}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2.5 text-base font-semibold">
                {copy.projectRole}
              </legend>
              <Choice
                name="projectRole"
                value="editor"
                defaultChecked
                title={roles.editor}
                hint={roleHints.editor}
              />
              <Choice
                name="projectRole"
                value="viewer"
                title={roles.viewer}
                hint={roleHints.viewer}
              />
              {fieldErrors?.projectRole ? (
                <p className="text-sm text-status-danger">
                  {fieldErrors.projectRole}
                </p>
              ) : null}
            </fieldset>
          </>
        ) : (
          <FormMessage>{copy.noProjects}</FormMessage>
        )
      ) : null}

      <FormField
        id="label"
        label={copy.label}
        optional={copy.labelOptional}
        hint={copy.labelHint}
        error={fieldErrors?.label}
      >
        <Input
          name="label"
          maxLength={80}
          autoCapitalize="words"
          placeholder={copy.labelPlaceholder}
          {...fieldA11y("label", copy.labelHint, fieldErrors?.label)}
        />
      </FormField>

      {state.status === "error" && state.message ? (
        <FormMessage>{state.message}</FormMessage>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending || (scope === "project" && !projects.length)}
        className="h-13 rounded-xl text-base"
      >
        <Link2 aria-hidden />
        {pending ? copy.submitting : copy.submit}
      </Button>
    </form>
  );
}

function InviteLink({
  link,
  teamHref,
  onAnother,
}: {
  link: string;
  teamHref: string;
  onAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    copy.whatsappMessage(APP_NAME, link),
  )}`;

  return (
    <section className="flex max-w-xl flex-col gap-4" aria-live="polite">
      <div>
        <h2 className="text-xl heading">{copy.readyTitle}</h2>
        <p className="mt-1.5 text-muted-foreground">{copy.readyDescription}</p>
      </div>
      <Input
        readOnly
        value={link}
        aria-label={copy.readyTitle}
        onFocus={(event) => event.currentTarget.select()}
        className="font-mono text-sm"
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          size="lg"
          className="rounded-xl"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? copy.copied : copy.copy}
        </Button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "rounded-xl",
          )}
        >
          <MessageCircle aria-hidden />
          {copy.sendWhatsapp}
        </a>
      </div>
      <div className="flex flex-col gap-1 border-t pt-4 sm:flex-row sm:gap-4">
        <Link
          href={teamHref}
          className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
        >
          {copy.done}
        </Link>
        <button
          type="button"
          onClick={onAnother}
          className="inline-flex min-h-11 items-center text-left font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {copy.another}
        </button>
      </div>
    </section>
  );
}
