import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { QuestionResult } from "@/lib/ai/answer-question";
import type { ExtractionResult } from "@/lib/ai/extract-expense";
import type { OutgoingMessage } from "@/lib/whatsapp/client";
import type { IncomingMessage } from "@/lib/whatsapp/webhook";

import {
  adminClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

vi.mock("server-only", () => ({}));

// Nada sai para a Meta: guarda o que o bot mandaria.
const sent: OutgoingMessage[] = [];
vi.mock("@/lib/whatsapp/client", () => ({
  markReadWithTyping: async () => {},
  sendMessage: async (_to: string, message: OutgoingMessage) => {
    sent.push(message);
    return `wamid.out.${crypto.randomUUID()}`;
  },
}));

// A IA é trocada por respostas prontas (a leitura real tem a própria avaliação).
const extractExpense = vi.fn<() => Promise<ExtractionResult>>();
vi.mock("@/lib/ai/extract-expense", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/extract-expense")>()),
  extractExpense,
}));

// Perguntas (quem só acompanha): a escolha das consultas também é simulada.
const chooseQueries = vi.fn<() => Promise<QuestionResult>>();
vi.mock("@/lib/ai/answer-question", () => ({ chooseQueries }));

const { handleIncomingMessage } =
  await import("@/lib/whatsapp/handlers/incoming");

const usage = { inputTokens: 100, outputTokens: 20 };
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(
    new Date(),
  );

const read = (
  fields: Partial<
    Extract<ExtractionResult, { kind: "expense" }>["expense"]
  > = {},
): ExtractionResult => ({
  kind: "expense",
  usage,
  expense: {
    amountCents: 30000,
    description: "Pedreiro",
    stageId: null,
    categoryCode: "mao_de_obra",
    supplierName: null,
    spentOn: today(),
    paymentMethod: null,
    hasInvoice: false,
    quantity: null,
    unit: null,
    confidence: 0.9,
    missing: [],
    ...fields,
  },
});

const randomPhone = () =>
  `55819${Math.floor(60000000 + Math.random() * 39999999)}`;

/**
 * Lançamento pelo WhatsApp de ponta a ponta, como o webhook roda (service
 * role), com a IA e o envio simulados: "300 pedreiro" vira lançamento
 * confirmado em até 2 interações; mensagem repetida não duplica; quem só
 * acompanha não lança.
 */
describe("lançamento pelo WhatsApp", () => {
  const admin = adminClient();
  let ana: TestUser;
  let bruno: TestUser;
  let anaPhone: string;
  let brunoPhone: string;
  let projectId: string;
  let stages: { id: string; name: string }[];

  const message = (
    from: string,
    fields: Partial<IncomingMessage>,
  ): IncomingMessage => ({
    id: `wamid.test.${crypto.randomUUID()}`,
    from,
    timestamp: `${Math.floor(Date.now() / 1000)}`,
    type: "text",
    ...fields,
  });
  const say = (from: string, body: string) =>
    handleIncomingMessage(admin, message(from, { text: { body } }));
  const tap = (from: string, id: string, list = false) =>
    handleIncomingMessage(
      admin,
      message(from, {
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
        "id, status, stage_id, amount_cents, source, created_by, categories(code)",
      )
      .eq("org_id", ana.orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return data;
  };
  const usageOf = async () => {
    const { data } = await admin
      .from("usage_counters")
      .select("whatsapp_entries, ai_calls, ai_input_tokens")
      .eq("org_id", ana.orgId)
      .maybeSingle();
    return data ?? { whatsapp_entries: 0, ai_calls: 0, ai_input_tokens: 0 };
  };

  beforeAll(async () => {
    ana = await createTestUser("wa-flow-ana");
    bruno = await createTestUser("wa-flow-bruno");
    anaPhone = randomPhone();
    brunoPhone = randomPhone();

    const { data: project, error } = await ana.client
      .from("projects")
      .insert({ org_id: ana.orgId, name: "Casa nova", created_by: ana.id })
      .select("id")
      .single();
    if (error) throw error;
    projectId = project.id;
    const { data: stageRows } = await admin
      .from("stages")
      .select("id, name")
      .eq("project_id", projectId)
      .order("sort_order");
    stages = stageRows ?? [];

    await admin
      .from("profiles")
      .update({ whatsapp_phone: anaPhone })
      .eq("id", ana.id);
    await admin
      .from("profiles")
      .update({ whatsapp_phone: brunoPhone })
      .eq("id", bruno.id);

    // Bruno só acompanha a obra da Ana.
    await admin
      .from("organization_members")
      .insert({ org_id: ana.orgId, user_id: bruno.id, role: "member" });
    await admin.from("project_members").insert({
      org_id: ana.orgId,
      project_id: projectId,
      user_id: bruno.id,
      role: "viewer",
    });
  });

  afterAll(async () => {
    await admin
      .from("whatsapp_messages")
      .delete()
      .in("from_phone", [anaPhone, brunoPhone]);
    await deleteTestUsers([bruno, ana].filter(Boolean));
  });

  it('"300 pedreiro" vira lançamento confirmado em 2 interações', async () => {
    extractExpense.mockResolvedValueOnce(read());
    let started = performance.now();
    await say(anaPhone, "300 pedreiro");
    const sayMs = performance.now() - started;

    // 1ª resposta: resumo + lista de etapas (escolher já confirma).
    const list = last();
    expect(list?.type).toBe("list");
    expect(list?.body).toContain("*R$ 300,00* · Mão de obra · Sem etapa");
    const pending = await latestExpense();
    expect(pending).toMatchObject({
      status: "pending",
      source: "whatsapp_text",
      created_by: ana.id,
    });

    // 2ª interação: escolher a etapa.
    started = performance.now();
    await tap(anaPhone, optionId("Alvenaria"), true);
    const tapMs = performance.now() - started;
    // Tempo do código e do banco (sem a IA e sem a Meta, que são simuladas).
    console.info(
      `[tempo] mensagem → resposta: ${sayMs.toFixed(0)} ms; etapa → lançado: ${tapMs.toFixed(0)} ms`,
    );
    const confirmed = await latestExpense();
    expect(confirmed).toMatchObject({
      id: pending?.id,
      status: "confirmed",
      stage_id: stages.find((s) => s.name === "Alvenaria")?.id,
      amount_cents: 30000,
      categories: { code: "mao_de_obra" },
    });
    expect(last()?.body).toContain("Lançado");
    expect(await usageOf()).toMatchObject({
      whatsapp_entries: 1,
      ai_calls: 1,
      ai_input_tokens: 100,
    });
  });

  it("mensagem repetida pela Meta não duplica o lançamento", async () => {
    extractExpense.mockResolvedValue(read({ description: "Repetida" }));
    const repeated = message(anaPhone, { text: { body: "200 servente" } });
    await handleIncomingMessage(admin, repeated);
    await handleIncomingMessage(admin, repeated);
    expect(extractExpense).toHaveBeenCalledTimes(1);
    extractExpense.mockReset();

    const { count } = await admin
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("org_id", ana.orgId)
      .eq("description", "Repetida");
    expect(count).toBe(1);
  });

  it("com a etapa já lida: Confirmar, Editar e Cancelar", async () => {
    const cobertura = stages.find((s) => s.name === "Cobertura")?.id ?? null;
    extractExpense.mockResolvedValueOnce(
      read({ stageId: cobertura, categoryCode: "material" }),
    );
    await say(anaPhone, "40 telhas 140");
    expect(last()?.type).toBe("buttons");

    // Editar a categoria e voltar ao resumo.
    await tap(anaPhone, optionId("Editar"));
    await tap(anaPhone, optionId("Categoria"), true);
    await tap(anaPhone, optionId("Frete"), true);
    expect(last()?.type).toBe("buttons");
    expect(last()?.body).toContain("Frete · Cobertura");

    await tap(anaPhone, optionId("Confirmar"));
    expect(await latestExpense()).toMatchObject({
      status: "confirmed",
      stage_id: cobertura,
      categories: { code: "frete" },
    });
  });

  it("sem valor: pergunta só o valor", async () => {
    extractExpense.mockResolvedValueOnce(
      read({ amountCents: null, description: "Cimento", missing: ["amount"] }),
    );
    await say(anaPhone, "comprei cimento");
    expect(last()?.body).toContain("Qual foi o valor de _Cimento_");

    await say(anaPhone, "R$ 78,50");
    expect(last()?.type).toBe("list");
    expect(await latestExpense()).toMatchObject({
      status: "pending",
      amount_cents: 7850,
    });

    await tap(anaPhone, optionId("Sem etapa"), true);
    expect(await latestExpense()).toMatchObject({
      status: "confirmed",
      stage_id: null,
    });
  });

  it("cancelar não lança nada e botão velho não faz nada", async () => {
    extractExpense.mockResolvedValueOnce(read());
    await say(anaPhone, "100 ajudante");
    const cancelId = optionId("Cancelar lançamento");
    const alvenariaId = optionId("Alvenaria");
    const before = await usageOf();

    await tap(anaPhone, cancelId, true);
    expect(last()?.body).toContain("Cancelado");
    expect((await latestExpense())?.status).toBe("cancelled");

    await tap(anaPhone, alvenariaId, true);
    expect(last()?.body).toContain("já foi confirmado ou cancelado");
    expect((await latestExpense())?.status).toBe("cancelled");
    expect((await usageOf()).whatsapp_entries).toBe(before.whatsapp_entries);
  });

  const supplierNamed = async (name: string) => {
    const { data } = await admin
      .from("suppliers")
      .select("id")
      .eq("org_id", ana.orgId)
      .eq("name", name);
    return data ?? [];
  };

  /**
   * O bot aceita 20 mensagens por minuto por número: os testes da Ana somam
   * mais que isso. Tira do log as mensagens já tratadas para abrir a janela.
   */
  const resetRateWindow = () =>
    admin.from("whatsapp_messages").delete().eq("from_phone", anaPhone);

  it("fornecedor lido só é cadastrado ao confirmar", async () => {
    await resetRateWindow();
    extractExpense.mockResolvedValueOnce(
      read({ categoryCode: "material", supplierName: "Loja do Zé" }),
    );
    await say(anaPhone, "2 sacos de cimento 78 na loja do zé");
    expect(last()?.body).toContain("Loja do Zé");
    const pending = await latestExpense();
    const { data: row } = await admin
      .from("expenses")
      .select("supplier_id")
      .eq("id", pending?.id ?? "")
      .single();
    expect(row?.supplier_id).toBeNull();
    expect(await supplierNamed("Loja do Zé")).toHaveLength(0);

    // Escolher a etapa confirma: o fornecedor nasce agora, ligado ao gasto.
    await tap(anaPhone, optionId("Fundação"), true);
    const supplier = await supplierNamed("Loja do Zé");
    expect(supplier).toHaveLength(1);
    const { data: confirmed } = await admin
      .from("expenses")
      .select("status, supplier_id")
      .eq("id", pending?.id ?? "")
      .single();
    expect(confirmed).toEqual({
      status: "confirmed",
      supplier_id: supplier[0]?.id,
    });
    expect(last()?.body).toContain("Loja do Zé");
  });

  it("fornecedor de um gasto cancelado não fica cadastrado", async () => {
    const cobertura = stages.find((s) => s.name === "Cobertura")?.id ?? null;
    extractExpense.mockResolvedValueOnce(
      read({ stageId: cobertura, supplierName: "Depósito Fantasma" }),
    );
    await say(anaPhone, "500 telha no depósito fantasma");
    await tap(anaPhone, optionId("Editar"));
    await tap(anaPhone, optionId("Data"), true);
    await tap(anaPhone, optionId("Hoje"), true);
    expect(last()?.body).toContain("Depósito Fantasma");
    await tap(anaPhone, optionId("Cancelar"));
    expect((await latestExpense())?.status).toBe("cancelled");
    expect(await supplierNamed("Depósito Fantasma")).toHaveLength(0);
  });

  it("quem só acompanha a obra não lança", async () => {
    const calls = extractExpense.mock.calls.length;
    chooseQueries.mockResolvedValueOnce({ kind: "off_topic", usage });
    await say(brunoPhone, "300 pedreiro");
    // Para quem só acompanha, toda mensagem é pergunta: nada é lançado.
    expect(last()?.body).toContain("Você só acompanha esta obra");
    expect(extractExpense.mock.calls.length).toBe(calls);
    const { count } = await admin
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("org_id", ana.orgId)
      .eq("created_by", bruno.id);
    expect(count).toBe(0);
  });

  it("com duas obras, pergunta qual e segue com a mensagem", async () => {
    await resetRateWindow();
    const { data: second } = await ana.client
      .from("projects")
      .insert({ org_id: ana.orgId, name: "Reforma", created_by: ana.id })
      .select("id")
      .single();
    // A obra ativa deixa de valer para forçar a pergunta.
    await admin
      .from("whatsapp_conversations")
      .update({ active_project_id: null })
      .eq("user_id", ana.id);

    extractExpense.mockResolvedValueOnce(read({ description: "Na reforma" }));
    await say(anaPhone, "300 pedreiro");
    expect(last()?.body).toBe("Em qual obra é esse gasto?");

    await tap(anaPhone, optionId("Reforma"), true);
    const { data } = await admin
      .from("expenses")
      .select("project_id, status")
      .eq("description", "Na reforma")
      .single();
    expect(data).toEqual({ project_id: second?.id, status: "pending" });
  });
});
