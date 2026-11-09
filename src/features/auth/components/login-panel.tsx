"use client";

import { Mail } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  sendEmailCode,
  type SendCodeState,
  signInWithGoogle,
  verifyEmailCode,
  type VerifyCodeState,
} from "../actions";
import { authCopy, type UrlErrorCode, urlErrors } from "../copy";
import { GoogleIcon } from "./google-icon";

const copy = authCopy.login;

/**
 * Painel de login. `next` e `errorCode` vêm da URL (?next=, ?erro=), lidos no
 * servidor pela página, para o formulário já chegar pronto no HTML.
 */
export function LoginPanel({
  next,
  errorCode,
}: {
  next: string;
  errorCode: string | null;
}) {
  const urlError =
    errorCode && Object.hasOwn(urlErrors, errorCode)
      ? urlErrors[errorCode as UrlErrorCode]
      : null;

  // "Usar outro e-mail" remonta o fluxo de e-mail, voltando ao campo vazio.
  const [attempt, setAttempt] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      {urlError ? <FormMessage>{urlError}</FormMessage> : null}

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <GoogleButton />
      </form>

      <div className="flex items-center gap-4 text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span className="text-sm">{copy.or}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <EmailFlow
        key={attempt}
        next={next}
        onRestart={() => setAttempt((n) => n + 1)}
      />
    </div>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      disabled={pending}
      className="h-13 w-full rounded-xl border-input bg-card text-base font-semibold"
    >
      <GoogleIcon className="size-5" />
      {copy.google}
    </Button>
  );
}

function EmailFlow({
  next,
  onRestart,
}: {
  next: string;
  onRestart: () => void;
}) {
  const [sendState, sendAction, sending] = useActionState<
    SendCodeState,
    FormData
  >(sendEmailCode, { status: "idle" });
  const [verifyState, verifyAction, verifying] = useActionState<
    VerifyCodeState,
    FormData
  >(verifyEmailCode, { status: "idle" });

  if (sendState.status === "sent") {
    return (
      <form action={verifyAction} className="flex flex-col gap-5">
        <div className="flex gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Mail className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg heading">{copy.sentTitle}</h2>
            <p className="mt-1 text-base text-muted-foreground">
              {copy.sentDescription(sendState.email)}
            </p>
          </div>
        </div>

        <input type="hidden" name="email" value={sendState.email} />
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-2.5">
          <Label htmlFor="token">{copy.codeLabel}</Label>
          <Input
            id="token"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={9}
            required
            aria-invalid={verifyState.status === "error" || undefined}
            className="h-14 text-center text-2xl font-bold tracking-[0.4em] tabular-nums"
          />
        </div>
        {verifyState.status === "error" ? (
          <FormMessage>{verifyState.message}</FormMessage>
        ) : null}
        <Button
          type="submit"
          variant="action"
          size="lg"
          disabled={verifying}
          className="h-13 w-full rounded-xl text-base"
        >
          {verifying ? copy.verifying : copy.verify}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onRestart}
          className="self-start px-2"
        >
          {copy.useOtherEmail}
        </Button>
      </form>
    );
  }

  return (
    <form action={sendAction} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-2.5">
        <Label htmlFor="email">{copy.emailLabel}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={copy.emailPlaceholder}
          defaultValue={sendState.status === "error" ? sendState.email : ""}
          required
          aria-invalid={sendState.status === "error" || undefined}
        />
      </div>
      {sendState.status === "error" ? (
        <FormMessage>{sendState.message}</FormMessage>
      ) : null}
      <Button
        type="submit"
        variant="action"
        size="lg"
        disabled={sending}
        className="h-13 w-full rounded-xl text-base"
      >
        {sending ? copy.sending : copy.sendCode}
      </Button>
    </form>
  );
}
