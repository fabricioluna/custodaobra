import {
  BarChart3,
  CalendarClock,
  FileText,
  Landmark,
  MessageCircleQuestion,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";

import { BrandMark } from "@/components/layout/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { APP_NAME, APP_TAGLINE } from "@/config/app";
import { ChatDemo } from "@/features/marketing/components/chat-demo";
import { Pricing } from "@/features/marketing/components/pricing";
import { SiteFooter } from "@/features/marketing/components/site-footer";
import { marketingCopy as copy } from "@/features/marketing/copy";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME} · ${APP_TAGLINE}` },
  description: copy.hero.description,
  openGraph: {
    title: APP_NAME,
    description: copy.hero.description,
    locale: "pt_BR",
    type: "website",
  },
};

const featureIcons = [
  BarChart3,
  Landmark,
  CalendarClock,
  Users,
  MessageCircleQuestion,
  FileText,
];

export default function HomePage() {
  return (
    <>
      <main className="flex flex-1 flex-col">
        <Hero />
        <Steps />
        <Features />
        <Audience />
        <section
          id="precos"
          className="scroll-mt-4 bg-concrete px-4 py-16 sm:px-10"
        >
          <div className="mx-auto max-w-6xl">
            <SectionTitle>{copy.pricing.title}</SectionTitle>
            <p className="mt-3 max-w-prose text-lg text-graphite">
              {copy.pricing.description}
            </p>
            <div className="mt-8 max-w-4xl">
              <Suspense fallback={<div className="h-80" />}>
                <Pricing />
              </Suspense>
            </div>
          </div>
        </section>
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

function CtaLink({ className }: { className?: string }) {
  return (
    <Link
      href={LOGIN_PATH}
      className={cn(
        buttonVariants({ variant: "action", size: "lg" }),
        "h-14 px-8 text-lg",
        className,
      )}
    >
      {copy.hero.cta}
    </Link>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-3xl heading sm:text-4xl">{children}</h2>;
}

function Hero() {
  return (
    <section className="bg-brand-navy blueprint-grid px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-16 text-brand-white sm:px-10">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <BrandMark iconSize={40} className="text-xl" />
        <nav className="flex items-center gap-1 sm:gap-4">
          <a
            href="#precos"
            className="hidden min-h-11 items-center px-2 text-brand-white/85 hover:text-brand-white sm:inline-flex"
          >
            {copy.nav.pricing}
          </a>
          <Link
            href={LOGIN_PATH}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "border-brand-white/40 bg-transparent text-brand-white hover:bg-brand-white/10 hover:text-brand-white",
            )}
          >
            {copy.nav.login}
          </Link>
        </nav>
      </header>

      <div className="mx-auto grid max-w-6xl items-center gap-12 pt-14 md:grid-cols-[1fr_auto] md:pt-20">
        <div className="max-w-2xl">
          <h1 className="text-[2.5rem] heading sm:text-6xl">{APP_TAGLINE}</h1>
          <p className="mt-6 max-w-prose text-lg text-brand-white/85 sm:text-xl">
            {copy.hero.description}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <CtaLink className="self-start" />
            <a
              href="#como-funciona"
              className="inline-flex min-h-11 items-center self-start px-1 text-brand-white underline underline-offset-4 hover:text-brand-white/80"
            >
              {copy.hero.secondary}
            </a>
          </div>
          <p className="mt-4 text-sm text-brand-white/70">{copy.hero.note}</p>
        </div>
        <ChatDemo />
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section
      id="como-funciona"
      className="scroll-mt-4 bg-background px-4 py-16 sm:px-10"
    >
      <div className="mx-auto max-w-6xl">
        <SectionTitle>{copy.steps.title}</SectionTitle>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {copy.steps.items.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-3">
              <span
                aria-hidden
                className="flex size-11 items-center justify-center rounded-full bg-brand-navy text-lg font-bold text-brand-white"
              >
                {index + 1}
              </span>
              <h3 className="text-xl font-bold">{step.title}</h3>
              <p className="text-graphite dark:text-brand-white/75">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="bg-concrete px-4 py-16 sm:px-10 dark:bg-brand-navy-soft">
      <div className="mx-auto max-w-6xl">
        <SectionTitle>{copy.features.title}</SectionTitle>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {copy.features.items.map((feature, index) => {
            const Icon = featureIcons[index] ?? BarChart3;
            return (
              <li
                key={feature.title}
                className="rounded-2xl bg-card p-6 text-card-foreground"
              >
                <Icon
                  aria-hidden
                  className="size-7 text-brand-navy dark:text-brand-gold"
                />
                <h3 className="mt-4 text-lg font-bold">{feature.title}</h3>
                <p className="mt-2 text-graphite dark:text-brand-white/75">
                  {feature.text}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Audience() {
  return (
    <section className="bg-background px-4 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <SectionTitle>{copy.audience.title}</SectionTitle>
        <ul className="mt-10 grid gap-8 md:grid-cols-2">
          {copy.audience.items.map((item) => (
            <li key={item.title} className="border-l-4 border-brand-gold pl-5">
              <h3 className="text-xl font-bold">{item.title}</h3>
              <p className="mt-2 text-graphite dark:text-brand-white/75">
                {item.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="bg-background px-4 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <SectionTitle>{copy.faq.title}</SectionTitle>
        <div className="mt-8 max-w-3xl divide-y border-y">
          {copy.faq.items.map((item) => (
            <details key={item.q} className="group py-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden
                  className="text-2xl leading-none transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-3 text-graphite dark:text-brand-white/75">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-brand-navy blueprint-grid px-4 py-16 text-brand-white sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <h2 className="max-w-3xl text-3xl heading sm:text-5xl">
          {copy.finalCta.title}
        </h2>
        <CtaLink className="self-start" />
      </div>
    </section>
  );
}
