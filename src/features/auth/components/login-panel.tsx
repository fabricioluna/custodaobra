"use client";

import { Mail } from "lucide-react";
import { type FormEvent, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NEW_PASSWORD_PATH, safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/client";

import {
  sendEmailCode,
  type SendCodeState,
  signInWithGoogle,
  verifyEmailCode,
  type VerifyCodeState,
} from "../actions";
import { authCopy, type UrlErrorCode, urlErrors } from "../copy";
import { authErrorMessage } from "../errors";
import {
  emailSchema,
  otpSchema,
  passwordLoginSchema,
  resetPasswordSchema,
  signUpSchema,
} from "../schemas";
import { GoogleIcon } from "./google-icon";
import { PasswordInput } from "./password-input";

const copy = authCopy.login;
const { errors } = authCopy;

type Mode = "password" | "signup" | "forgot" | "code";

/**
 * Painel de login. `next` e `errorCode` vêm da URL (?next=, ?erro=), lidos no
 * servidor pela página, para o formulário já chegar pronto no HTML.
 *
 * Senha, cadastro e nova senha falam com o Supabase direto do navegador: o
 * limite de tentativas do Supabase conta por pessoa (pelo IP dela), e não
 * pelo servidor da Vercel, que é o mesmo para todo mundo. O código por
 * e-mail continua pelas ações do servidor.
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

  const [mode, setMode] = useState<Mode>("password");
  // Trocar de modo ou "Usar outro e-mail" remonta o formulário, vazio.
  const [attempt, setAttempt] = useState(0);
  const go = (to: Mode) => {
    setMode(to);
    setAttempt((n) => n + 1);
  };
  const destination = safeNextPath(next);

  return (
    <div className="flex flex-col gap-6">
      {urlError ? <FormMessage>{urlError}</FormMessage> : null}

      {mode === "password" || mode === "signup" ? (
        <>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <GoogleButton />
          </form>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span className="text-sm">{copy.or}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      {mode === "password" ? (
        <PasswordLogin key={attempt} next={destination} onMode={go} />
      ) : mode === "signup" ? (
        <SignUp key={attempt} next={destination} onMode={go} />
      ) : mode === "forgot" ? (
        <ForgotPassword key={attempt} next={destination} onMode={go} />
      ) : (
        <>
          <EmailFlow key={attempt} next={next} onRestart={() => go("code")} />
          <LinkButton onClick={() => go("password")}>
            {copy.backToLogin}
          </LinkButton>
        </>
      )}
    </div>
  );
}

/** Abre a próxima tela com a página inteira, para o servidor ler a sessão. */
function enter(next: string) {
  window.location.assign(next);
}

/** Endereço do link dos e-mails (`{{ .RedirectTo }}` nos modelos). */
function confirmUrl(next: string) {
  return `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;
}

/** Envio de formulário com estado de "enviando" e mensagem de erro. */
function useSubmit(handler: (data: FormData) => Promise<string | void>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const message = await handler(new FormData(event.currentTarget));
      if (message) setError(message);
    } catch {
      setError(errors.generic);
    } finally {
      setPending(false);
    }
  };
  return { pending, error, onSubmit };
}

const text = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
};

function PasswordLogin({
  next,
  onMode,
}: {
  next: string;
  onMode: (mode: Mode) => void;
}) {
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const { pending, error, onSubmit } = useSubmit(async (data) => {
    const parsed = passwordLoginSchema.safeParse({
      email: text(data, "email"),
      password: text(data, "password"),
    });
    if (!parsed.success) return parsed.error.issues[0]?.message;
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error?.code === "email_not_confirmed") {
      // Cadastrou e não confirmou: manda um código novo e pede aqui mesmo.
      const resent = await supabase.auth.resend({
        type: "signup",
        email: parsed.data.email,
        options: { emailRedirectTo: confirmUrl(next) },
      });
      if (resent.error) return authErrorMessage(resent.error);
      setConfirmEmail(parsed.data.email);
      return;
    }
    if (error) return authErrorMessage(error, errors.wrongPassword);
    enter(next);
  });

  if (confirmEmail) {
    return (
      <ConfirmCode
        email={confirmEmail}
        next={next}
        notice={errors.notConfirmed}
        onRestart={() => onMode("password")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <EmailField invalid={Boolean(error)} />
        <div className="flex flex-col gap-2.5">
          <Label htmlFor="password">{copy.passwordLabel}</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(error) || undefined}
          />
        </div>
        {error ? <FormMessage>{error}</FormMessage> : null}
        <SubmitButton
          pending={pending}
          label={copy.signIn}
          busy={copy.signingIn}
        />
      </form>
      <div className="flex flex-col items-start gap-1">
        <LinkButton onClick={() => onMode("forgot")}>{copy.forgot}</LinkButton>
        <LinkButton onClick={() => onMode("code")}>{copy.useCode}</LinkButton>
      </div>
      <p className="text-base">
        {copy.noAccount}{" "}
        <LinkButton inline onClick={() => onMode("signup")}>
          {copy.createAccount}
        </LinkButton>
      </p>
    </div>
  );
}

function SignUp({
  next,
  onMode,
}: {
  next: string;
  onMode: (mode: Mode) => void;
}) {
  const signUpCopy = copy.signUp;
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const { pending, error, onSubmit } = useSubmit(async (data) => {
    const parsed = signUpSchema.safeParse({
      email: text(data, "email"),
      password: text(data, "password"),
    });
    if (!parsed.success) return parsed.error.issues[0]?.message;
    const supabase = createClient();
    const { data: result, error } = await supabase.auth.signUp({
      ...parsed.data,
      options: { emailRedirectTo: confirmUrl(next) },
    });
    if (error) return authErrorMessage(error);
    // Com a confirmação ligada, o Supabase não diz que o e-mail já existe:
    // devolve um usuário sem identidades e não manda e-mail nenhum.
    if (result.user && result.user.identities?.length === 0) {
      return errors.accountExists;
    }
    // Confirmação desligada: já entra.
    if (result.session) return enter(next);
    setConfirmEmail(parsed.data.email);
  });

  if (confirmEmail) {
    return (
      <ConfirmCode
        email={confirmEmail}
        next={next}
        onRestart={() => onMode("signup")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg heading">{signUpCopy.title}</h2>
        <p className="mt-1 text-base text-muted-foreground">
          {signUpCopy.description}
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <EmailField invalid={Boolean(error)} />
        <div className="flex flex-col gap-2.5">
          <Label htmlFor="password">{signUpCopy.passwordLabel}</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            aria-describedby="password-hint"
            aria-invalid={Boolean(error) || undefined}
          />
          <p id="password-hint" className="text-sm text-muted-foreground">
            {signUpCopy.passwordHint}
          </p>
        </div>
        {error ? <FormMessage>{error}</FormMessage> : null}
        <SubmitButton
          pending={pending}
          label={signUpCopy.submit}
          busy={signUpCopy.submitting}
        />
      </form>
      <p className="text-base">
        {copy.haveAccount}{" "}
        <LinkButton inline onClick={() => onMode("password")}>
          {copy.signIn}
        </LinkButton>
      </p>
    </div>
  );
}

/** Código de 6 dígitos do cadastro (uma vez só); confirmado, já entra. */
function ConfirmCode({
  email,
  next,
  notice,
  onRestart,
}: {
  email: string;
  next: string;
  notice?: string;
  onRestart: () => void;
}) {
  const signUpCopy = copy.signUp;
  const { pending, error, onSubmit } = useSubmit(async (data) => {
    const token = otpSchema.safeParse(text(data, "token"));
    if (!token.success) return token.error.issues[0]?.message;
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: token.data,
      type: "email",
    });
    if (error) return authErrorMessage(error, errors.wrongCode);
    enter(next);
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <SentHeader
        title={signUpCopy.confirmTitle}
        description={signUpCopy.confirmDescription(email)}
      />
      {notice ? <p className="text-base">{notice}</p> : null}
      <CodeField label={copy.codeOnlyLabel} invalid={Boolean(error)} />
      {error ? <FormMessage>{error}</FormMessage> : null}
      <SubmitButton
        pending={pending}
        label={signUpCopy.confirm}
        busy={copy.verifying}
      />
      <LinkButton onClick={onRestart}>{copy.useOtherEmail}</LinkButton>
    </form>
  );
}

/**
 * Esqueci a senha (ou nunca tive uma): código por e-mail e a senha nova na
 * mesma tela. O link do e-mail leva a /nova-senha.
 */
function ForgotPassword({
  next,
  onMode,
}: {
  next: string;
  onMode: (mode: Mode) => void;
}) {
  const flow = copy.forgotFlow;
  const [sentTo, setSentTo] = useState<string | null>(null);

  const request = useSubmit(async (data) => {
    const email = emailSchema.safeParse(text(data, "email"));
    if (!email.success) return email.error.issues[0]?.message;
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: confirmUrl(NEW_PASSWORD_PATH),
    });
    // Não diz se a conta existe: só falha por limite ou erro de rede.
    if (error) return authErrorMessage(error);
    setSentTo(email.data);
  });

  const reset = useSubmit(async (data) => {
    const parsed = resetPasswordSchema.safeParse({
      email: sentTo,
      token: text(data, "token"),
      password: text(data, "password"),
    });
    if (!parsed.success) return parsed.error.issues[0]?.message;
    const supabase = createClient();
    const verified = await supabase.auth.verifyOtp({
      email: parsed.data.email,
      token: parsed.data.token,
      type: "recovery",
    });
    if (verified.error)
      return authErrorMessage(verified.error, errors.wrongCode);
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) return authErrorMessage(error);
    enter(next);
  });

  if (sentTo) {
    return (
      <form
        onSubmit={reset.onSubmit}
        className="flex flex-col gap-5"
        noValidate
      >
        <SentHeader
          title={flow.sentTitle}
          description={flow.sentDescription(sentTo)}
        />
        <CodeField label={copy.codeOnlyLabel} invalid={Boolean(reset.error)} />
        <div className="flex flex-col gap-2.5">
          <Label htmlFor="password">{flow.newPasswordLabel}</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-sm text-muted-foreground">
            {copy.signUp.passwordHint}
          </p>
        </div>
        {reset.error ? <FormMessage>{reset.error}</FormMessage> : null}
        <SubmitButton
          pending={reset.pending}
          label={flow.save}
          busy={flow.saving}
        />
        <LinkButton onClick={() => onMode("forgot")}>
          {copy.useOtherEmail}
        </LinkButton>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg heading">{flow.title}</h2>
        <p className="mt-1 text-base text-muted-foreground">
          {flow.description}
        </p>
      </div>
      <form
        onSubmit={request.onSubmit}
        className="flex flex-col gap-5"
        noValidate
      >
        <EmailField invalid={Boolean(request.error)} />
        {request.error ? <FormMessage>{request.error}</FormMessage> : null}
        <SubmitButton
          pending={request.pending}
          label={flow.submit}
          busy={copy.sending}
        />
      </form>
      <LinkButton onClick={() => onMode("password")}>
        {copy.backToLogin}
      </LinkButton>
    </div>
  );
}

function EmailField({ invalid }: { invalid: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Label htmlFor="email">{copy.emailLabel}</Label>
      <Input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        placeholder={copy.emailPlaceholder}
        required
        aria-invalid={invalid || undefined}
      />
    </div>
  );
}

function CodeField({ label, invalid }: { label: string; invalid: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Label htmlFor="token">{label}</Label>
      <Input
        id="token"
        name="token"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={9}
        required
        aria-invalid={invalid || undefined}
        className="h-14 text-center text-2xl font-bold tracking-[0.4em] tabular-nums"
      />
    </div>
  );
}

function SentHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Mail className="size-5" aria-hidden />
      </span>
      <div>
        <h2 className="text-lg heading">{title}</h2>
        <p className="mt-1 text-base text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function SubmitButton({
  pending,
  label,
  busy,
}: {
  pending: boolean;
  label: string;
  busy: string;
}) {
  return (
    <Button
      type="submit"
      variant="action"
      size="lg"
      disabled={pending}
      className="h-13 w-full rounded-xl text-base"
    >
      {pending ? busy : label}
    </Button>
  );
}

function LinkButton({
  onClick,
  inline = false,
  children,
}: {
  onClick: () => void;
  inline?: boolean;
  children: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={
        inline
          ? "h-11 px-1 align-baseline text-base font-semibold underline underline-offset-2"
          : "h-11 px-2"
      }
    >
      {children}
    </Button>
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

/** Acesso por código (ou link) no e-mail, sem senha. */
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
        <SentHeader
          title={copy.sentTitle}
          description={copy.sentDescription(sendState.email)}
        />
        <input type="hidden" name="email" value={sendState.email} />
        <input type="hidden" name="next" value={next} />
        <CodeField
          label={copy.codeLabel}
          invalid={verifyState.status === "error"}
        />
        {verifyState.status === "error" ? (
          <FormMessage>{verifyState.message}</FormMessage>
        ) : null}
        <SubmitButton
          pending={verifying}
          label={copy.verify}
          busy={copy.verifying}
        />
        <LinkButton onClick={onRestart}>{copy.useOtherEmail}</LinkButton>
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
      <SubmitButton
        pending={sending}
        label={copy.sendCode}
        busy={copy.sending}
      />
    </form>
  );
}
