import "server-only";

import { z } from "zod";

import { APP_NAME } from "@/config/app";

/**
 * Cliente mínimo da API v3 do Asaas, com `fetch` (sem SDK). Sem
 * `ASAAS_API_KEY`, a cobrança fica desligada. O endereço padrão é o sandbox;
 * a produção exige `ASAAS_API_URL=https://api.asaas.com` de propósito.
 */
const SANDBOX_URL = "https://api-sandbox.asaas.com";
const TIMEOUT_MS = 15_000;

export function isAsaasConfigured(): boolean {
  return Boolean(process.env.ASAAS_API_KEY);
}

export class AsaasError extends Error {
  constructor(
    readonly status: number,
    readonly description: string,
  ) {
    super(`Asaas ${status}: ${description}`);
  }
}

const errorSchema = z.object({
  errors: z.array(z.object({ description: z.string() })).min(1),
});

async function request<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new AsaasError(0, "ASAAS_API_KEY ausente");
  const baseUrl = process.env.ASAAS_API_URL ?? SANDBOX_URL;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
      // O Asaas pede um User-Agent nas contas novas.
      "User-Agent": APP_NAME,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = errorSchema.safeParse(json);
    throw new AsaasError(
      response.status,
      parsed.success
        ? parsed.data.errors.map((e) => e.description).join("; ")
        : response.statusText,
    );
  }
  return schema.parse(json);
}

const idSchema = z.object({ id: z.string().min(1) });

/** Cliente já criado para a conta (uma tentativa anterior que não chegou a ser guardada). */
export async function findCustomerByReference(
  externalReference: string,
): Promise<string | null> {
  const list = await request(
    "GET",
    `/v3/customers?externalReference=${encodeURIComponent(externalReference)}&limit=1`,
    z.object({ data: z.array(idSchema) }),
  );
  return list.data[0]?.id ?? null;
}

export async function createCustomer(input: {
  name: string;
  cpfCnpj: string;
  email: string;
  externalReference: string;
}): Promise<string> {
  const customer = await request("POST", "/v3/customers", idSchema, input);
  return customer.id;
}

export async function createSubscription(input: {
  customer: string;
  value: number;
  nextDueDate: string;
  description: string;
  externalReference: string;
}): Promise<string> {
  const subscription = await request("POST", "/v3/subscriptions", idSchema, {
    ...input,
    // A pessoa escolhe na fatura: Pix, boleto ou cartão.
    billingType: "UNDEFINED",
    cycle: "MONTHLY",
  });
  return subscription.id;
}

export async function deleteSubscription(id: string): Promise<void> {
  await request(
    "DELETE",
    `/v3/subscriptions/${encodeURIComponent(id)}`,
    z.object({ deleted: z.boolean() }),
  );
}

const paymentSchema = z.object({
  id: z.string(),
  status: z.string(),
  dueDate: z.string(),
  value: z.number(),
  invoiceUrl: z.string().url(),
});
export type AsaasPayment = z.infer<typeof paymentSchema>;

/**
 * Cobranças da assinatura ainda por pagar (atrasadas e pendentes), a mais
 * antiga primeiro. O filtro vai para o Asaas: a lista dele é paginada.
 */
export async function listOpenPayments(
  subscriptionId: string,
): Promise<AsaasPayment[]> {
  const path = (status: string) =>
    `/v3/subscriptions/${encodeURIComponent(subscriptionId)}/payments?status=${status}`;
  const schema = z.object({ data: z.array(paymentSchema.passthrough()) });
  const [overdue, pending] = await Promise.all([
    request("GET", path("OVERDUE"), schema),
    request("GET", path("PENDING"), schema),
  ]);
  return [...overdue.data, ...pending.data].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
}
