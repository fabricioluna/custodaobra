import Image from "next/image";
import type { ReactNode } from "react";

import { marketingCopy } from "../copy";

const copy = marketingCopy.demo;

/**
 * Conversa de exemplo com o bot, em HTML (sem imagem), com o texto que o bot
 * manda de verdade: "300 pedreiro" → etapa → lançado. As cores imitam um chat
 * genérico, sem copiar a interface do WhatsApp.
 */
export function ChatDemo() {
  return (
    <figure
      aria-label={copy.label}
      className="w-full max-w-sm overflow-hidden rounded-[1.75rem] border-4 border-brand-white/15 bg-chat-wall text-[0.95rem] text-chat-text shadow-2xl"
    >
      <figcaption className="flex items-center gap-3 bg-brand-navy-soft px-4 py-3 text-brand-white">
        <Image
          src="/brand/icon.svg"
          alt=""
          width={36}
          height={36}
          unoptimized
          className="rounded-full"
        />
        <span className="flex flex-col leading-tight">
          <span className="font-semibold">{copy.botName}</span>
          <span className="text-xs text-brand-white/70">{copy.status}</span>
        </span>
      </figcaption>

      <div className="flex flex-col gap-2 p-3" aria-hidden>
        <Bubble side="out">{copy.userMessage}</Bubble>
        <Bubble side="in">
          <span className="block">{copy.botSummary}</span>
          <span className="mt-2 block font-semibold">{copy.botQuestion}</span>
        </Bubble>
        <div className="flex max-w-[85%] flex-col gap-1">
          {copy.stages.map((stage) => (
            <span
              key={stage}
              className={
                stage === copy.choice
                  ? "rounded-lg bg-chat-in px-3 py-1.5 text-center font-medium text-chat-button ring-2 ring-brand-gold"
                  : "rounded-lg bg-chat-in/80 px-3 py-1.5 text-center text-chat-button"
              }
            >
              {stage}
            </span>
          ))}
        </div>
        <Bubble side="out">{copy.choice}</Bubble>
        <Bubble side="in">
          <span className="block font-semibold">{copy.done}</span>
          <span className="block">{copy.doneSummary}</span>
        </Bubble>
      </div>
    </figure>
  );
}

function Bubble({
  side,
  children,
}: {
  side: "in" | "out";
  children: ReactNode;
}) {
  return (
    <p
      className={
        side === "out"
          ? "max-w-[85%] self-end rounded-xl rounded-tr-sm bg-chat-out px-3 py-2 shadow-sm"
          : "max-w-[85%] self-start rounded-xl rounded-tl-sm bg-chat-in px-3 py-2 shadow-sm"
      }
    >
      {children}
      <span className="mt-1 block text-right text-[0.7rem] text-chat-meta">
        {copy.time}
      </span>
    </p>
  );
}
