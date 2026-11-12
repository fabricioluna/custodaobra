import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { AsaasError, createSubscription, listOpenPayments } =
  await import("@/lib/billing/asaas");

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("ASAAS_API_KEY", "chave-teste");
  vi.stubEnv("ASAAS_API_URL", "https://api-sandbox.asaas.com");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

const subscription = {
  customer: "cus_1",
  value: 19.9,
  nextDueDate: "2026-11-20",
  description: "Plano",
  externalReference: "org-1",
};

describe("cliente do Asaas", () => {
  it("cria a assinatura mensal com a forma de pagamento livre", async () => {
    fetchMock.mockResolvedValue(json(200, { id: "sub_1" }));
    expect(await createSubscription(subscription)).toBe("sub_1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api-sandbox.asaas.com/v3/subscriptions");
    expect(init.headers.access_token).toBe("chave-teste");
    expect(JSON.parse(init.body)).toMatchObject({
      billingType: "UNDEFINED",
      cycle: "MONTHLY",
      value: 19.9,
    });
  });

  it("erro do Asaas vira AsaasError com a descrição", async () => {
    fetchMock.mockResolvedValue(
      json(400, { errors: [{ description: "CPF inválido" }] }),
    );
    const promise = createSubscription(subscription);
    await expect(promise).rejects.toBeInstanceOf(AsaasError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      description: "CPF inválido",
    });
  });

  it("faturas em aberto: só pendentes e atrasadas, a mais antiga primeiro", async () => {
    const payment = (id: string, status: string, dueDate: string) => ({
      id,
      status,
      dueDate,
      value: 19.9,
      invoiceUrl: `https://sandbox.asaas.com/i/${id}`,
    });
    fetchMock.mockResolvedValue(
      json(200, {
        data: [
          payment("p3", "PENDING", "2026-12-20"),
          payment("p1", "RECEIVED", "2026-10-20"),
          payment("p2", "OVERDUE", "2026-11-20"),
        ],
      }),
    );
    const open = await listOpenPayments("sub_1");
    expect(open.map((p) => p.id)).toEqual(["p2", "p3"]);
  });
});
