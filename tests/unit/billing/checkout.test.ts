import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { firstDueDate } = await import("@/lib/billing/checkout");
const { isAsaasWebhookAuthorized } =
  await import("@/lib/billing/asaas-webhook");
const { parseCheckoutForm } = await import("@/features/billing/schemas");

const now = new Date("2026-11-12T15:00:00Z");
const tz = "America/Recife";

describe("firstDueDate", () => {
  it("no teste, a primeira cobrança vence no fim dele", () => {
    expect(
      firstDueDate(
        {
          status: "trialing",
          trial_ends_at: "2026-11-20T03:00:00Z",
          current_period_end: null,
        },
        tz,
        now,
      ),
    ).toBe("2026-11-20");
  });

  it("teste vencido: hoje", () => {
    expect(
      firstDueDate(
        {
          status: "trialing",
          trial_ends_at: "2026-11-01T03:00:00Z",
          current_period_end: null,
        },
        tz,
        now,
      ),
    ).toBe("2026-11-12");
  });

  it("cancelada com período pago: no fim do período", () => {
    expect(
      firstDueDate(
        {
          status: "cancelled",
          trial_ends_at: null,
          current_period_end: "2026-12-05T02:59:59Z",
        },
        tz,
        now,
      ),
    ).toBe("2026-12-04");
  });
});

describe("isAsaasWebhookAuthorized", () => {
  it("só com o token certo", () => {
    expect(isAsaasWebhookAuthorized("segredo", "segredo")).toBe(true);
    expect(isAsaasWebhookAuthorized("errado!", "segredo")).toBe(false);
    expect(isAsaasWebhookAuthorized(null, "segredo")).toBe(false);
    expect(isAsaasWebhookAuthorized("segredo", undefined)).toBe(false);
  });
});

describe("parseCheckoutForm", () => {
  const form = (data: Record<string, string>) => {
    const fd = new FormData();
    for (const [key, value] of Object.entries(data)) fd.set(key, value);
    return fd;
  };

  it("primeira vez: confere o CPF e guarda só os dígitos", () => {
    const parsed = parseCheckoutForm(
      form({
        planCode: "profissional",
        name: "Maria",
        document: "529.982.247-25",
        email: "maria@exemplo.com",
      }),
      true,
    );
    expect(parsed.success && parsed.data).toEqual({
      planCode: "profissional",
      name: "Maria",
      document: "52998224725",
      email: "maria@exemplo.com",
    });
  });

  it("recusa documento com dígito errado", () => {
    const parsed = parseCheckoutForm(
      form({
        planCode: "profissional",
        name: "Maria",
        document: "529.982.247-26",
        email: "maria@exemplo.com",
      }),
      true,
    );
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["document"]);
  });

  it("com cliente já criado, só o plano", () => {
    expect(
      parseCheckoutForm(form({ planCode: "pessoal" }), false).success,
    ).toBe(true);
  });
});
