import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { checkMemberCount, checkProjectCount, isSubscriptionUsable } =
  await import("@/lib/billing/limits");

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

describe("isSubscriptionUsable", () => {
  const now = new Date("2026-11-08T12:00:00Z");

  it("ativa e em teste podem usar", () => {
    expect(
      isSubscriptionUsable({ status: "active", trial_ends_at: null }, now),
    ).toBe(true);
    expect(
      isSubscriptionUsable(
        { status: "trialing", trial_ends_at: "2026-11-20T00:00:00Z" },
        now,
      ),
    ).toBe(true);
  });

  it("cancelada sem teste em vigor não pode", () => {
    expect(
      isSubscriptionUsable({ status: "cancelled", trial_ends_at: null }, now),
    ).toBe(false);
    expect(
      isSubscriptionUsable(
        { status: "cancelled", trial_ends_at: "2026-11-01T00:00:00Z" },
        now,
      ),
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
