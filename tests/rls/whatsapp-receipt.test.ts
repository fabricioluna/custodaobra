import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { ReceiptResult } from "@/lib/ai/read-receipt";
import type { OutgoingMessage } from "@/lib/whatsapp/client";
import type { IncomingMessage } from "@/lib/whatsapp/webhook";

import {
  adminClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

vi.mock("server-only", () => ({}));

// Nada sai para a Meta: guarda o que o bot mandaria e devolve uma "foto".
const sent: OutgoingMessage[] = [];
const downloads: string[] = [];
vi.mock("@/lib/whatsapp/client", () => ({
  markReadWithTyping: async () => {},
  sendMessage: async (_to: string, message: OutgoingMessage) => {
    sent.push(message);
    return `wamid.out.${crypto.randomUUID()}`;
  },
  MediaTooLargeError: class extends Error {},
  downloadMedia: async (mediaId: string) => {
    downloads.push(mediaId);
    return {
      data: new TextEncoder().encode(`foto ${mediaId}`).buffer,
      mimeType: "image/jpeg",
    };
  },
}));

// A IA de visão é trocada por respostas prontas (a leitura real tem a
// própria avaliação em tests/ai).
const readReceipt = vi.fn<() => Promise<ReceiptResult>>();
vi.mock("@/lib/ai/read-receipt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/read-receipt")>()),
  readReceipt,
}));

const { handleIncomingMessage } =
  await import("@/lib/whatsapp/handlers/incoming");
const { purgeCancelledReceipts } = await import("@/lib/whatsapp/receipts");

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(
    new Date(),
  );

// CNPJ e chave fictícios, com os dígitos verificadores certos.
const CNPJ = "11222333000181";
const KEY = "26111111222333000181650010000123451000123450";

const receipt = (
  fields: Partial<Extract<ReceiptResult, { kind: "receipt" }>["expense"]> = {},
  details: Partial<Extract<ReceiptResult, { kind: "receipt" }>["details"]> = {},
): ReceiptResult => ({
  kind: "receipt",
  usage: { inputTokens: 1500, outputTokens: 300 },
  expense: {
    amountCents: 15600,
    description: "Cimento e areia",
    stageId: null,
    categoryCode: "material",
    supplierName: "Casa do Construtor",
    spentOn: today(),
    paymentMethod: "pix",
    hasInvoice: true,
    quantity: null,
    unit: null,
    confidence: 0.9,
    missing: ["stage"],
    ...fields,
  },
  details: {
    supplierDocument: CNPJ,
    invoiceNumber: "123",
    accessKey: KEY,
    items: [
      {
        description: "Cimento CP II 50kg",
        quantity: 2,
        unit: "saco",
        unitPriceCents: 3900,
        totalCents: 7800,
      },
      {
        description: "Areia média",
        quantity: 1,
        unit: "m³",
        unitPriceCents: 7800,
        totalCents: 7800,
      },
    ],
    ...details,
  },
});

const randomPhone = () =>
  `55819${Math.floor(60000000 + Math.random() * 39999999)}`;

/**
 * Foto (ou PDF) de cupom pelo WhatsApp, como o webhook roda (service role),
 * com a IA e a Meta simuladas: o gasto nasce pendente com a foto no bucket e
 * os itens; o fornecedor nasce com o CNPJ só ao confirmar; o cron apaga a
 * foto dos gastos cancelados.
 */
describe("comprovante pelo WhatsApp", () => {
  const admin = adminClient();
  let carla: TestUser;
  let phone: string;

  const message = (fields: Partial<IncomingMessage>): IncomingMessage => ({
    id: `wamid.test.${crypto.randomUUID()}`,
    from: phone,
    timestamp: `${Math.floor(Date.now() / 1000)}`,
    type: "text",
    ...fields,
  });
  const photo = (mimeType = "image/jpeg", caption?: string) =>
    handleIncomingMessage(
      admin,
      message({
        type: "image",
        image: {
          id: `media-${crypto.randomUUID()}`,
          mime_type: mimeType,
          caption,
        },
      }),
    );
  const say = (body: string) =>
    handleIncomingMessage(admin, message({ text: { body } }));
  const tap = (id: string, list = false) =>
    handleIncomingMessage(
      admin,
      message({
        type: "interactive",
        interactive: list
          ? { type: "list_reply", list_reply: { id, title: "x" } }
          : { type: "button_reply", button_reply: { id, title: "x" } },
      }),
    );
  const last = () => sent.at(-1);
  const optionId = (title: string) => {
    const message = last();
    if (message?.type === "list") {
      return message.rows.find((row) => row.title === title)?.id ?? "";
    }
    if (message?.type === "buttons") {
      return message.buttons.find((b) => b.title === title)?.id ?? "";
    }
    return "";
  };
  const latestExpense = async () => {
    const { data } = await admin
      .from("expenses")
      .select(
        "id, status, source, amount_cents, has_invoice, invoice_number, nfe_access_key, supplier_id, attachments(storage_path, mime_type), expense_items(description, total_cents)",
      )
      .eq("org_id", carla.orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return data;
  };
  const suppliers = async () => {
    const { data } = await admin
      .from("suppliers")
      .select("id, name, document")
      .eq("org_id", carla.orgId);
    return data ?? [];
  };
  const fileExists = async (path: string) => {
    const slash = path.lastIndexOf("/");
    const { data } = await admin.storage
      .from("comprovantes")
      .list(path.slice(0, slash));
    return (data ?? []).some((file) => file.name === path.slice(slash + 1));
  };

  beforeAll(async () => {
    carla = await createTestUser("wa-receipt-carla");
    phone = randomPhone();
    const { error } = await carla.client.from("projects").insert({
      org_id: carla.orgId,
      name: "Casa da praia",
      created_by: carla.id,
    });
    if (error) throw error;
    await admin
      .from("profiles")
      .update({ whatsapp_phone: phone })
      .eq("id", carla.id);
  });

  afterAll(async () => {
    // Fotos que sobraram (gastos confirmados) saem junto com a conta.
    const { data } = await admin
      .from("attachments")
      .select("storage_path")
      .eq("org_id", carla.orgId);
    if (data?.length) {
      await admin.storage
        .from("comprovantes")
        .remove(data.map((row) => row.storage_path));
    }
    await admin.from("whatsapp_messages").delete().eq("from_phone", phone);
    await deleteTestUsers([carla].filter(Boolean));
  });

  it("foto vira pendente com a foto e os itens; fornecedor com CNPJ só ao confirmar", async () => {
    readReceipt.mockResolvedValueOnce(receipt());
    await photo("image/jpeg", "material da fundação");

    expect(last()?.type).toBe("list");
    expect(last()?.body).toContain(
      "*R$ 156,00* · Material · Sem etapa · Cimento e areia · 2 itens · Casa do Construtor",
    );
    const pending = await latestExpense();
    expect(pending).toMatchObject({
      status: "pending",
      source: "whatsapp_image",
      has_invoice: true,
      invoice_number: "123",
      nfe_access_key: KEY,
      supplier_id: null,
    });
    expect(pending?.expense_items).toHaveLength(2);
    expect(pending?.attachments).toHaveLength(1);
    expect(pending?.attachments[0]?.mime_type).toBe("image/jpeg");
    expect(
      pending?.attachments[0]?.storage_path.startsWith(
        `${carla.orgId}/${pending.id}/`,
      ),
    ).toBe(true);
    expect(await suppliers()).toHaveLength(0);

    await tap(optionId("Fundação"), true);
    expect(last()?.body).toContain("Lançado");
    const confirmed = await latestExpense();
    expect(confirmed?.status).toBe("confirmed");
    const [supplier] = await suppliers();
    expect(supplier).toMatchObject({
      name: "Casa do Construtor",
      document: CNPJ,
    });
    expect(confirmed?.supplier_id).toBe(supplier?.id);
  });

  it("mesmo CNPJ com outro nome usa o fornecedor já cadastrado", async () => {
    readReceipt.mockResolvedValueOnce(
      receipt({ supplierName: "CASA DO CONSTRUTOR LTDA" }),
    );
    await photo();
    await tap(optionId("Sem etapa"), true);
    const list = await suppliers();
    expect(list).toHaveLength(1);
    expect((await latestExpense())?.supplier_id).toBe(list[0]?.id);
  });

  it("sem total: pergunta o valor, baixa a foto de novo e o cron apaga se cancelar", async () => {
    readReceipt.mockResolvedValueOnce(
      receipt(
        { amountCents: null, missing: ["amount", "stage"] },
        { items: [] },
      ),
    );
    const before = downloads.length;
    await photo();
    expect(last()?.body).toContain("Não consegui ler o total");

    await say("156");
    expect(downloads.length).toBe(before + 2);
    const pending = await latestExpense();
    expect(pending).toMatchObject({
      status: "pending",
      source: "whatsapp_image",
      amount_cents: 15600,
    });
    const path = pending?.attachments[0]?.storage_path ?? "";
    expect(await fileExists(path)).toBe(true);

    await tap(optionId("Cancelar lançamento"), true);
    expect((await latestExpense())?.status).toBe("cancelled");

    expect(await purgeCancelledReceipts(admin)).toBeGreaterThanOrEqual(1);
    expect((await latestExpense())?.attachments).toEqual([]);
    expect(await fileExists(path)).toBe(false);
  });

  it("tipo de arquivo que não dá para ler: avisa sem chamar a IA", async () => {
    const calls = readReceipt.mock.calls.length;
    await photo("image/heic");
    expect(last()?.body).toContain("não consigo ler");
    expect(readReceipt.mock.calls.length).toBe(calls);
  });

  it("imagem que não é comprovante: avisa e não lança", async () => {
    const before = await latestExpense();
    readReceipt.mockResolvedValueOnce({
      kind: "not_receipt",
      usage: { inputTokens: 1500, outputTokens: 20 },
    });
    await photo();
    expect(last()?.body).toContain("Não achei um cupom");
    expect((await latestExpense())?.id).toBe(before?.id);
  });
});
