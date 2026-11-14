"use client";

import { type FormEvent, useState } from "react";

import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

import { authCopy } from "../copy";
import { authErrorMessage } from "../errors";
import { newPasswordSchema } from "../schemas";
import { PasswordInput } from "./password-input";

const copy = authCopy.newPassword;

/**
 * Cria ou troca a senha da pessoa logada (pelo navegador, com a sessão dela).
 * Usado na página do link de "Esqueci minha senha" e em Seus dados.
 * `continueTo`: depois de salvar, mostra o botão para seguir.
 */
export function NewPasswordForm({ continueTo }: { continueTo?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const value = new FormData(form).get("password");
    const parsed = newPasswordSchema.safeParse(
      typeof value === "string" ? value : "",
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? authCopy.errors.generic);
      return;
    }
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const { error } = await createClient().auth.updateUser({
        password: parsed.data,
      });
      if (error) {
        setError(authErrorMessage(error));
        return;
      }
      form.reset();
      setSaved(true);
    } catch {
      setError(authCopy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  if (saved && continueTo) {
    return (
      <div className="flex flex-col gap-5">
        <FormMessage tone="success">{copy.saved}</FormMessage>
        <Button
          type="button"
          variant="action"
          size="lg"
          className="h-13 w-full rounded-xl text-base"
          onClick={() => window.location.assign(continueTo)}
        >
          {copy.continue}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2.5">
        <Label htmlFor="new-password">{copy.label}</Label>
        <PasswordInput
          id="new-password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          aria-describedby="new-password-hint"
          aria-invalid={Boolean(error) || undefined}
        />
        <p id="new-password-hint" className="text-sm text-muted-foreground">
          {copy.hint}
        </p>
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {saved ? <FormMessage tone="success">{copy.saved}</FormMessage> : null}
      <Button
        type="submit"
        variant={continueTo ? "action" : "outline"}
        size="lg"
        disabled={pending}
        className={continueTo ? "h-13 w-full rounded-xl text-base" : undefined}
      >
        {pending ? copy.saving : copy.save}
      </Button>
    </form>
  );
}
