import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { QuestionResult } from "@/lib/ai/answer-question";
import type { ExtractionResult } from "@/lib/ai/extract-expense";
import type { ExpenseFilters, QueryCall } from "@/lib/ai/query-tools";
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

// As duas IAs são trocadas por respostas prontas (cada uma tem a avaliação
// própria com a API de verdade em tests/ai).
const extractExpense = vi.fn<() => Promise<ExtractionResult>>();
vi.mock("@/lib/ai/extract-expense", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/extract-expense")>()),
  extractExpense,
}));
const chooseQueries = vi.fn<() => Promise<QuestionResult>>();
vi.mock("@/lib/ai/answer-question", () => ({ chooseQueries }));

const { handleIncomingMessage } =
  await import("@/lib/whatsapp/handlers/incoming");

const usage = { inputTokens: 100, outputTokens: 20 };
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(
    new Date(),
  );
const daysAgo = (days: number) => {
  const date = new Date(`${today()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

const noFilters: ExpenseFilters = {
  from: null,
  to: null,
  stageId: null,
  categoryCode: null,
  supplier: null,
  search: null,
  paymentMethod: null,
};
const queries = (...calls: QueryCall[]): QuestionResult => ({
  kind: "queries",
  calls,
  usage,
});
const question: ExtractionResult = { kind: "question", usage };

const randomPhone = () =>
  `55819${Math.floor(60000000 + Math.random() * 39999999)}`;

/**
 * Perguntas livres pelo WhatsApp de ponta a ponta, contra o banco de
 * verdade: a IA (simulada) escolhe as consultas; o código consulta só a obra
 * ativa da conta certa e escreve a resposta. Gastos pendentes, excluídos e de
 * outra conta não entram; quem só acompanha também pergunta.
 */
describe("perguntas pelo WhatsApp", () => {
  const admin = adminClient();
  let ana: TestUser;
  let bruno: TestUser;
  let carla: TestUser;
  let anaPhone: string;
  let carlaPhone: string;
  let projectId: string;
  let alvenariaId: string;

  const say = (from: string, body: string) =>
    handleIncomingMessage(admin, {
      id: `wamid.test.${crypto.randomUUID()}`,
      from,
      timestamp: `${Math.floor(Date.now() / 1000)}`,
      type: "text",
      text: { body },
    } satisfies IncomingMessage);
  const lastBody = () => (sent.at(-1)?.body ?? "").replace(/ /g, " ");
  const aiCalls = async () => {
    const { data } = await admin
      .from("usage_counters")
      .select("ai_calls, whatsapp_entries")
      .eq("org_id", ana.orgId)
      .maybeSingle();
    return data ?? { ai_calls: 0, whatsapp_entries: 0 };
  };

  beforeAll(async () => {
    [ana, bruno, carla] = await Promise.all([
      createTestUser("wa-q-ana"),
      createTestUser("wa-q-bruno"),
      createTestUser("wa-q-carla"),
    ]);
    anaPhone = randomPhone();
    carlaPhone = randomPhone();

    const { data: categories } = await admin
      .from("categories")
      .select("id, code")
      .is("org_id", null);
    const category = (code: string) =>
      categories!.find((c) => c.code === code)!.id;

    const { data: project, error } = await ana.client
      .from("projects")
      .insert({ org_id: ana.orgId, name: "Casa do sítio", created_by: ana.id })
      .select("id")
      .single();
    if (error) throw error;
    projectId = project.id;
    const { data: stages } = await admin
      .from("stages")
      .select("id, name")
      .eq("project_id", projectId);
    alvenariaId = stages!.find((s) => s.name === "Alvenaria")!.id;
    await ana.client
      .from("stages")
      .update({ budget_cents: 100_000, progress_percent: 30 })
      .eq("id", alvenariaId);

    const { data: supplier } = await ana.client
      .from("suppliers")
      .insert({ org_id: ana.orgId, name: "Loja do Zé", kind: "loja" })
      .select("id")
      .single();

    const expense = (fields: {
      description: string;
      amount_cents: number;
      code?: string;
      status?: "confirmed" | "pending";
      deleted?: boolean;
      supplier?: boolean;
      spent_on?: string;
      stage?: boolean;
    }) => ({
      org_id: ana.orgId,
      project_id: projectId,
      category_id: category(fields.code ?? "material"),
      description: fields.description,
      amount_cents: fields.amount_cents,
      spent_on: fields.spent_on ?? today(),
      status: fields.status ?? "confirmed",
      stage_id: fields.stage ? alvenariaId : null,
      supplier_id: fields.supplier ? supplier!.id : null,
      deleted_at: fields.deleted ? new Date().toISOString() : null,
      created_by: ana.id,
    });
    const inserted = await ana.client.from("expenses").insert([
      expense({
        description: "Cimento (2 sacos)",
        amount_cents: 10_000,
        supplier: true,
        stage: true,
      }),
      expense({
        description: "Cimento",
        amount_cents: 5_000,
        spent_on: daysAgo(1),
        stage: true,
      }),
      expense({
        description: "Pedreiro",
        amount_cents: 30_000,
        code: "mao_de_obra",
      }),
      expense({
        description: "Lote",
        amount_cents: 1_000_000,
        code: "terreno",
      }),
      // Não entram em nenhum total:
      expense({
        description: "Cimento",
        amount_cents: 77_700,
        status: "pending",
      }),
      expense({ description: "Cimento", amount_cents: 88_800, deleted: true }),
    ]);
    if (inserted.error) throw inserted.error;

    // Outra conta, mesma palavra: não pode aparecer na resposta da Ana.
    const { data: brunoProject } = await bruno.client
      .from("projects")
      .insert({ org_id: bruno.orgId, name: "Outra casa", created_by: bruno.id })
      .select("id")
      .single();
    await bruno.client.from("expenses").insert({
      org_id: bruno.orgId,
      project_id: brunoProject!.id,
      category_id: category("material"),
      description: "Cimento",
      amount_cents: 99_900,
      spent_on: today(),
      status: "confirmed",
      created_by: bruno.id,
    });

    const payable = await ana.client.from("payables").insert({
      org_id: ana.orgId,
      project_id: projectId,
      category_id: category("mao_de_obra"),
      stage_id: alvenariaId,
      description: "Empreita do muro",
      amount_cents: 40_000,
      due_date: daysAgo(3),
      created_by: ana.id,
    });
    if (payable.error) throw payable.error;

    await admin
      .from("profiles")
      .update({ whatsapp_phone: anaPhone })
      .eq("id", ana.id);
    await admin
      .from("profiles")
      .update({ whatsapp_phone: carlaPhone })
      .eq("id", carla.id);
    // Carla só acompanha a obra da Ana.
    await admin
      .from("organization_members")
      .insert({ org_id: ana.orgId, user_id: carla.id, role: "member" });
    await admin.from("project_members").insert({
      org_id: ana.orgId,
      project_id: projectId,
      user_id: carla.id,
      role: "viewer",
    });
  });

  // Muitas mensagens seguidas: as antigas "saem" do minuto do rate limit.
  beforeEach(async () => {
    if (!anaPhone) return;
    const old = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await admin
      .from("whatsapp_messages")
      .update({ created_at: old })
      .in("from_phone", [anaPhone, carlaPhone])
      .gte("created_at", old);
  });

  afterAll(async () => {
    await admin
      .from("whatsapp_messages")
      .delete()
      .in("from_phone", [anaPhone, carlaPhone]);
    await deleteTestUsers([carla, bruno, ana].filter(Boolean));
  });

  it("soma só os gastos confirmados da obra, com a palavra pedida", async () => {
    const before = await aiCalls();
    extractExpense.mockResolvedValueOnce(question);
    chooseQueries.mockResolvedValueOnce(
      queries({
        name: "total_spent",
        filters: { ...noFilters, search: "cimento" },
      }),
    );
    await say(anaPhone, "quanto gastei com cimento?");

    const body = lastBody();
    expect(body).toContain("*Gasto · “cimento”*");
    // 100 + 50: sem o pendente, o excluído e o da outra conta.
    expect(body).toContain("*R$ 150,00* em 2 gastos");
    expect(body).toContain("_Obra: Casa do sítio_");

    // A pergunta recebeu as etapas da obra; as duas chamadas contam no plano.
    const [, context] = chooseQueries.mock.calls.at(-1) as unknown as [
      string,
      { stages: { name: string }[] },
    ];
    expect(context.stages.map((s) => s.name)).toContain("Alvenaria");
    const after = await aiCalls();
    expect(after.ai_calls - before.ai_calls).toBe(2);
    expect(after.whatsapp_entries).toBe(before.whatsapp_entries);
  });

  it("total da obra separa construção e terreno", async () => {
    extractExpense.mockResolvedValueOnce(question);
    chooseQueries.mockResolvedValueOnce(
      queries({ name: "total_spent", filters: noFilters }),
    );
    await say(anaPhone, "quanto já gastei?");
    const body = lastBody();
    expect(body).toContain("*R$ 10.450,00* em 4 gastos");
    expect(body).toContain("Construção: R$ 450,00");
    expect(body).toContain("Terreno: R$ 10.000,00");
  });

  it("fornecedor, data e várias consultas na mesma pergunta", async () => {
    extractExpense.mockResolvedValueOnce(question);
    chooseQueries.mockResolvedValueOnce(
      queries(
        {
          name: "total_spent",
          filters: { ...noFilters, supplier: "loja do zé" },
        },
        {
          name: "total_spent",
          filters: { ...noFilters, from: daysAgo(1), to: daysAgo(1) },
        },
        {
          name: "total_spent",
          filters: { ...noFilters, supplier: "Depósito que não existe" },
        },
      ),
    );
    await say(anaPhone, "quanto comprei na loja do zé e quanto gastei ontem?");
    const answers = lastBody().split("\n\n");
    expect(answers[0]).toContain("*R$ 100,00* em 1 gasto");
    expect(answers[1]).toContain("*Gasto · ontem*");
    expect(answers[1]).toContain("*R$ 50,00* em 1 gasto");
    expect(answers[2]).toContain("Nenhum gasto confirmado encontrado.");
  });

  it("divide por categoria e lista os últimos gastos", async () => {
    extractExpense.mockResolvedValueOnce(question);
    chooseQueries.mockResolvedValueOnce(
      queries(
        {
          name: "spending_breakdown",
          filters: noFilters,
          groupBy: "category",
        },
        { name: "recent_expenses", filters: noFilters, limit: 2 },
      ),
    );
    await say(anaPhone, "onde gastei mais e quais os últimos gastos?");
    const body = lastBody();
    expect(body).toContain("• Terreno: R$ 10.000,00");
    expect(body).toContain("• Mão de obra: R$ 300,00");
    expect(body).toContain("*Últimos gastos*");
    expect(body.match(/^• hoje/gm)).toHaveLength(2);
  });

  it("orçamento da etapa e contas atrasadas", async () => {
    extractExpense.mockResolvedValueOnce(question);
    chooseQueries.mockResolvedValueOnce(
      queries(
        { name: "budget_status", stageId: alvenariaId },
        { name: "payables", status: "overdue", from: null, to: null },
      ),
    );
    await say(anaPhone, "como está a alvenaria? tem conta atrasada?");
    const body = lastBody();
    expect(body).toContain("*Orçamento · Alvenaria*");
    expect(body).toContain("Previsto: R$ 1.000,00");
    expect(body).toContain("Gasto: *R$ 150,00* (15%)");
    expect(body).toContain("Contas a pagar: R$ 400,00");
    expect(body).toContain("*Contas atrasadas*");
    expect(body).toContain("1 conta · *R$ 400,00*");
    expect(body).toContain("Empreita do muro");
  });

  it("pergunta fora do assunto ou não entendida", async () => {
    extractExpense.mockResolvedValueOnce(question);
    chooseQueries.mockResolvedValueOnce({ kind: "off_topic", usage });
    await say(anaPhone, "quanto custa o cimento no mercado?");
    expect(lastBody()).toContain("eu respondo perguntas sobre os gastos");

    extractExpense.mockResolvedValueOnce(question);
    chooseQueries.mockResolvedValueOnce({
      kind: "failed",
      reason: "invalid_output",
      usage,
    });
    await say(anaPhone, "e aquilo lá?");
    expect(lastBody()).toContain("Não consegui entender a pergunta");
  });

  it("pergunta no meio de um lançamento não mexe no pendente", async () => {
    extractExpense.mockResolvedValueOnce({
      kind: "expense",
      usage,
      expense: {
        amountCents: 12_000,
        description: "Servente",
        stageId: null,
        categoryCode: "mao_de_obra",
        supplierName: null,
        spentOn: today(),
        paymentMethod: null,
        hasInvoice: false,
        quantity: null,
        unit: null,
        confidence: 0.9,
        missing: ["stage"],
      },
    });
    await say(anaPhone, "120 servente");
    const { data: conversation } = await admin
      .from("whatsapp_conversations")
      .select("pending_expense_id, state")
      .eq("user_id", ana.id)
      .single();
    expect(conversation?.pending_expense_id).toBeTruthy();

    extractExpense.mockResolvedValueOnce(question);
    chooseQueries.mockResolvedValueOnce(
      queries({ name: "total_spent", filters: noFilters }),
    );
    await say(anaPhone, "quanto já gastei?");

    const [{ data: pending }, { data: after }] = await Promise.all([
      admin
        .from("expenses")
        .select("status")
        .eq("id", conversation!.pending_expense_id!)
        .single(),
      admin
        .from("whatsapp_conversations")
        .select("pending_expense_id, state")
        .eq("user_id", ana.id)
        .single(),
    ]);
    expect(pending?.status).toBe("pending");
    expect(after).toEqual(conversation);
  });

  it("quem só acompanha pergunta sem passar pela leitura do gasto", async () => {
    const before = await aiCalls();
    const extractions = extractExpense.mock.calls.length;
    chooseQueries.mockResolvedValueOnce(
      queries({
        name: "total_spent",
        filters: { ...noFilters, search: "cimento" },
      }),
    );
    await say(carlaPhone, "quanto foi de cimento?");
    expect(extractExpense.mock.calls.length).toBe(extractions);
    expect(lastBody()).toContain("*R$ 150,00* em 2 gastos");
    expect(lastBody()).toContain("_Obra: Casa do sítio_");
    // Conta no plano da conta da obra, sem contar como lançamento.
    const after = await aiCalls();
    expect(after.ai_calls - before.ai_calls).toBe(1);

    await say(carlaPhone, "ajuda");
    expect(lastBody()).toContain("Você acompanha obras");
    await say(carlaPhone, "obras");
    expect(lastBody()).toContain("Você acompanha a obra *Casa do sítio*");
  });
  it("com os lançamentos do mês esgotados, perguntas continuam", async () => {
    const { data: plan } = await admin
      .from("subscriptions")
      .select("plans!subscriptions_plan_code_fkey(max_whatsapp_entries_month)")
      .eq("org_id", ana.orgId)
      .single();
    const month = `${today().slice(0, 7)}-01`;
    const { data: current } = await admin
      .from("usage_counters")
      .select("whatsapp_entries")
      .eq("org_id", ana.orgId)
      .eq("month", month)
      .single();
    await admin
      .from("usage_counters")
      .update({
        whatsapp_entries: plan!.plans!.max_whatsapp_entries_month,
      })
      .eq("org_id", ana.orgId)
      .eq("month", month);
    try {
      extractExpense.mockResolvedValueOnce(question);
      chooseQueries.mockResolvedValueOnce(
        queries({ name: "total_spent", filters: noFilters }),
      );
      await say(anaPhone, "quanto já gastei?");
      expect(lastBody()).toContain("Construção:");

      // Um gasto, não: o limite de lançamentos vale.
      extractExpense.mockResolvedValueOnce({
        kind: "expense",
        usage,
        expense: {
          amountCents: 5_000,
          description: "Prego",
          stageId: null,
          categoryCode: "material",
          supplierName: null,
          spentOn: today(),
          paymentMethod: null,
          hasInvoice: false,
          quantity: null,
          unit: null,
          confidence: 0.9,
          missing: [],
        },
      });
      await say(anaPhone, "50 de prego");
      expect(lastBody()).toContain("O limite de lançamentos");
      const { count } = await admin
        .from("expenses")
        .select("id", { count: "exact", head: true })
        .eq("org_id", ana.orgId)
        .eq("description", "Prego");
      expect(count).toBe(0);
    } finally {
      await admin
        .from("usage_counters")
        .update({ whatsapp_entries: current?.whatsapp_entries ?? 0 })
        .eq("org_id", ana.orgId)
        .eq("month", month);
    }
  });
});
