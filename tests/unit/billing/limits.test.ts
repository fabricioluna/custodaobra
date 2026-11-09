import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { checkProjectCount, isSubscriptionUsable } =
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
