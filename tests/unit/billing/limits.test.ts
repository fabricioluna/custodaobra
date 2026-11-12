import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  checkMemberCount,
  checkProjectCount,
  isSubscriptionUsable,
  subscriptionState,
} = await import("@/lib/billing/limits");

describe("checkProjectCount", () => {
  it("deixa criar enquanto está abaixo do limite", () => {
    expect(checkProjectCount({ max_projects: 1 }, 0)).toEqual({ ok: true });
    expect(checkProjectCount({ max_projects: 10 }, 9)).toEqual({ ok: true });
  });

  it("bloqueia ao atingir o limite e informa qual é", () => {
    expect(checkProjectCount({ max_projects: 1 }, 1)).toEqual({
      ok: false,
      reason: "max_projects",
      limit: 1,
    });
  });
});

describe("subscriptionState", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const sub = (
    status: "active" | "trialing" | "past_due" | "cancelled",
    trial: string | null,
    period: string | null = null,
  ) => ({ status, trial_ends_at: trial, current_period_end: period });
  const live = (s: ReturnType<typeof sub>) => subscriptionState(s, now, true);

  it("em teste: pode usar e conta os dias que faltam", () => {
    expect(live(sub("trialing", "2026-11-11T12:00:00Z"))).toEqual({
      phase: "trial",
      usable: true,
      daysLeft: 3,
    });
  });

  it("teste vencido bloqueia só com a cobrança no ar", () => {
    const over = sub("trialing", "2026-11-08T11:00:00Z");
    expect(live(over)).toEqual({
      phase: "trial_over",
      usable: false,
      daysLeft: 0,
    });
    expect(subscriptionState(over, now, false).usable).toBe(true);
    expect(isSubscriptionUsable(over, now, false)).toBe(true);
  });

  it("ativa pode usar", () => {
    expect(live(sub("active", null, "2026-12-08T12:00:00Z")).usable).toBe(true);
  });

  it("atrasada tem 7 dias de tolerância depois do vencimento", () => {
    expect(live(sub("past_due", null, "2026-11-02T12:00:00Z"))).toMatchObject({
      phase: "past_due",
      usable: true,
    });
    expect(live(sub("past_due", null, "2026-10-31T12:00:00Z"))).toMatchObject({
      phase: "past_due_over",
      usable: false,
    });
  });

  it("cancelada vale até o fim do período pago, mesmo sem cobrança no ar", () => {
    expect(live(sub("cancelled", null, "2026-11-20T00:00:00Z")).usable).toBe(
      true,
    );
    expect(live(sub("cancelled", null)).usable).toBe(false);
    expect(
      subscriptionState(sub("cancelled", "2026-11-01T00:00:00Z"), now, false)
        .usable,
    ).toBe(false);
  });
});

describe("checkMemberCount", () => {
  it("conta membros e convites pendentes juntos", () => {
    expect(checkMemberCount({ max_members: 3 }, 1, 1)).toEqual({ ok: true });
    expect(checkMemberCount({ max_members: 3 }, 2, 1)).toEqual({
      ok: false,
      reason: "max_members",
      limit: 3,
    });
  });

  it("bloqueia quando só os membros já ocupam o plano", () => {
    expect(checkMemberCount({ max_members: 3 }, 3, 0).ok).toBe(false);
  });
});

describe("limites do WhatsApp e da IA", async () => {
  const { checkAiCalls, checkWhatsappEntries, monthOf } =
    await import("@/lib/billing/limits");

  it("WhatsApp desligado no plano barra tudo", () => {
    expect(
      checkWhatsappEntries(
        { whatsapp_enabled: false, max_whatsapp_entries_month: 300 },
        0,
      ),
    ).toEqual({ ok: false, reason: "whatsapp_disabled" });
  });

  it("lançamentos pelo WhatsApp até o limite do mês", () => {
    const plan = { whatsapp_enabled: true, max_whatsapp_entries_month: 300 };
    expect(checkWhatsappEntries(plan, 299)).toEqual({ ok: true });
    expect(checkWhatsappEntries(plan, 300)).toEqual({
      ok: false,
      reason: "max_whatsapp_entries",
      limit: 300,
    });
  });

  it("chamadas de IA até o limite do mês", () => {
    expect(checkAiCalls({ max_ai_calls_month: 600 }, 599)).toEqual({
      ok: true,
    });
    expect(checkAiCalls({ max_ai_calls_month: 600 }, 600)).toEqual({
      ok: false,
      reason: "max_ai_calls",
      limit: 600,
    });
  });

  it("mês do plano é o primeiro dia do mês", () => {
    expect(monthOf("2026-11-09")).toBe("2026-11-01");
  });
});
