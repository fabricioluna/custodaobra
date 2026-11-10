import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoRefresh } from "@/features/whatsapp/components/auto-refresh";
import { DevTap } from "@/features/whatsapp/components/dev-tap";
import { simulateText } from "@/features/whatsapp/dev-actions";
import { requireUserId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatPhone, phoneVariants } from "@/lib/whatsapp/phone";

export const metadata: Metadata = {
  title: "Simulador do WhatsApp",
  robots: { index: false, follow: false },
};

/**
 * Só em desenvolvimento: a conversa do seu número com o bot (o que você
 * mandou e o que ele respondeu, inclusive o que a Meta não entregou), com os
 * botões clicáveis e um campo para simular mensagens sem o celular.
 */
export default function DevWhatsappPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 bg-background p-4">
      <header>
        <h1 className="text-xl heading">Simulador do WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Só em desenvolvimento. As mensagens do celular também aparecem aqui.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted-foreground">Carregando…</p>}>
        <Conversation />
      </Suspense>
    </main>
  );
}

type Payload = {
  text?: { body?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
  body?: string;
  buttons?: { id: string; title: string }[];
  rows?: { id: string; title: string; description?: string }[];
  buttonLabel?: string;
};

async function Conversation() {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("whatsapp_phone")
    .eq("id", userId)
    .single();
  const phone = profile?.whatsapp_phone;
  if (!phone) {
    return (
      <p>
        Seu WhatsApp não está ligado. Ligue em{" "}
        <Link href="/inicio" className="underline">
          Configurações &gt; WhatsApp
        </Link>{" "}
        e volte aqui.
      </p>
    );
  }

  const { data } = await createAdminClient()
    .from("whatsapp_messages")
    .select("id, direction, type, payload, error, created_at")
    .in("from_phone", phoneVariants(phone))
    .order("created_at", { ascending: false })
    .limit(40);
  const messages = (data ?? []).reverse();

  return (
    <>
      <AutoRefresh seconds={3} />
      <p className="text-sm text-muted-foreground">
        Número: {formatPhone(phone)}
      </p>
      <ol className="flex flex-col gap-2">
        {messages.map((message) => {
          const payload = (message.payload ?? {}) as Payload;
          const incoming = message.direction === "in";
          const text = incoming
            ? (payload.text?.body ??
              payload.interactive?.button_reply?.title ??
              payload.interactive?.list_reply?.title ??
              `[${message.type}]`)
            : (payload.body ?? "");
          return (
            <li
              key={message.id}
              className={cn(
                "max-w-[85%] rounded-2xl border p-3 text-sm whitespace-pre-wrap",
                incoming
                  ? "self-end border-primary/30 bg-primary/10"
                  : "self-start bg-card",
              )}
            >
              {text}
              {payload.buttons?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {payload.buttons.map((button) => (
                    <DevTap
                      key={button.id}
                      kind="button"
                      id={button.id}
                      title={button.title}
                    />
                  ))}
                </div>
              ) : null}
              {payload.rows?.length ? (
                <div className="mt-2 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Lista: {payload.buttonLabel}
                  </span>
                  {payload.rows.map((row) => (
                    <DevTap
                      key={row.id}
                      kind="list"
                      id={row.id}
                      title={row.title}
                      description={row.description}
                    />
                  ))}
                </div>
              ) : null}
              {message.error ? (
                <p className="mt-1 text-xs text-status-danger">
                  {message.error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <form
        action={simulateText}
        className="sticky bottom-0 flex gap-2 bg-background py-3"
      >
        <Input
          name="text"
          placeholder="Ex.: 300 pedreiro"
          aria-label="Mensagem"
          autoComplete="off"
        />
        <Button type="submit">Enviar</Button>
      </form>
    </>
  );
}
