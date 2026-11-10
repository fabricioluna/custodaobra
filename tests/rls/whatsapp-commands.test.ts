import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

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
// Quantos envios seguidos a "Meta" vai recusar.
let failingSends = 0;
vi.mock("@/lib/whatsapp/client", () => ({
  markReadWithTyping: async () => {},
  sendMessage: async (_to: string, message: OutgoingMessage) => {
    if (failingSends > 0) {
      failingSends--;
      throw new Error("WhatsApp API respondeu 500");
    }
    sent.push(message);
    return `wamid.out.${crypto.randomUUID()}`;
  },
}));

const extractExpense = vi.fn<() => Promise<ExtractionResult>>();
vi.mock("@/lib/ai/extract-expense", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/extract-expense")>()),
  extractExpense,
}));

const { handleIncomingMessage } =
  await import("@/lib/whatsapp/handlers/incoming");

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(
    new Date(),
  );

type Extracted = Extract<ExtractionResult, { kind: "expense" }>["expense"];

const read = (
  description: string,
  fields: Partial<Extracted> = {},
): ExtractionResult => ({
  kind: "expense",
  usage: { inputTokens: 10, outputTokens: 5 },
  expense: {
    amountCents: 30000,
    description,
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
 * Comandos do bot (ajuda, obras, resumo, desfazer) e as tarefas do cron
 * (pendentes antigos e limpeza do log), contra o banco de verdade.
 */
describe("comandos do WhatsApp e cron", () => {
  const admin = adminClient();
  let ana: TestUser;
  let anaPhone: string;
  let projectId: string;
  let secondId: string;

  const say = (body: string, id = `wamid.test.${crypto.randomUUID()}`) =>
    handleIncomingMessage(admin, {
      id,
      from: anaPhone,
      timestamp: `${Math.floor(Date.now() / 1000)}`,
      type: "text",
      text: { body },
    } satisfies IncomingMessage);
  const tap = (id: string) =>
    handleIncomingMessage(admin, {
      id: `wamid.test.${crypto.randomUUID()}`,
      from: anaPhone,
      timestamp: `${Math.floor(Date.now() / 1000)}`,
      type: "interactive",
      interactive: { type: "list_reply", list_reply: { id, title: "x" } },
    });
  const last = () => sent.at(-1);
  const rowId = (title: string) => {
    const message = last();
    return message?.type === "list"
      ? (message.rows.find((row) => row.title === title)?.id ?? "")
      : "";
  };
  const expenseByDescription = async (description: string) => {
    const { data } = await admin
      .from("expenses")
      .select("id, status, project_id")
      .eq("org_id", ana.orgId)
      .eq("description", description)
      .single();
    return data;
  };

  beforeAll(async () => {
    ana = await createTestUser("wa-cmd-ana");
    anaPhone = randomPhone();
    const { data, error } = await ana.client
      .from("projects")
      .insert({ org_id: ana.orgId, name: "Casa da praia", created_by: ana.id })
      .select("id")
      .single();
    if (error) throw error;
    projectId = data.id;
    await admin
      .from("profiles")
      .update({ whatsapp_phone: anaPhone })
      .eq("id", ana.id);
  });

  // Os testes mandam muitas mensagens seguidas: as antigas "saem" do último
  // minuto para o rate limit não atrapalhar (ele tem teste próprio).
  beforeEach(async () => {
    if (!anaPhone) return;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await admin
      .from("whatsapp_messages")
      .update({ created_at: fiveMinutesAgo })
      .eq("from_phone", anaPhone)
      .gte("created_at", fiveMinutesAgo);
  });

  afterAll(async () => {
    await admin.from("whatsapp_messages").delete().eq("from_phone", anaPhone);
    await deleteTestUsers([ana].filter(Boolean));
  });

  it("ajuda responde sem chamar a IA", async () => {
    await say("Ajuda");
    expect(last()?.body).toContain("Comandos:");
    expect(extractExpense).not.toHaveBeenCalled();
  });

  it("obras com uma obra só avisa qual é", async () => {
    await say("obras");
    expect(last()?.body).toContain("Sua obra é *Casa da praia*");
  });

  it("lança, mostra no resumo e desfaz", async () => {
    extractExpense.mockResolvedValueOnce(read("Pedreiro da semana"));
    await say("300 pedreiro");
    await tap(rowId("Fundação"));
    expect(last()?.body).toContain("Lançado");

    await say("resumo");
    const body = last()?.body.replace(/ /g, " ") ?? "";
    expect(body).toContain("*Resumo · Casa da praia*");
    expect(body).toContain("Gasto na construção: *R$ 300,00*");
    expect(body).toContain("• Fundação: R$ 300,00");

    await say("desfazer");
    expect(last()?.body).toContain("Desfeito");
    expect((await expenseByDescription("Pedreiro da semana"))?.status).toBe(
      "cancelled",
    );

    // Nada mais para desfazer.
    await say("desfazer");
    expect(last()?.body).toContain("Não achei lançamento");
  });

  it("desfazer não pega lançamento de mais de 10 minutos", async () => {
    extractExpense.mockResolvedValueOnce(read("Servente antigo"));
    await say("120 servente");
    await tap(rowId("Fundação"));
    // Só o relógio do código anda 11 minutos.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    try {
      await say("desfazer");
    } finally {
      vi.useRealTimers();
    }
    expect(last()?.body).toContain("Não achei lançamento");
    expect((await expenseByDescription("Servente antigo"))?.status).toBe(
      "confirmed",
    );
  });

  it("editar no app não reabre o prazo do desfazer", async () => {
    const expense = await expenseByDescription("Servente antigo");
    // Confirmado há 11 minutos e editado agora no app (updated_at novo).
    const confirmedAt = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    await admin
      .from("expenses")
      .update({ confirmed_at: confirmedAt })
      .eq("id", expense!.id);
    const { error: editError } = await ana.client
      .from("expenses")
      .update({ has_invoice: true })
      .eq("id", expense!.id);
    expect(editError).toBeNull();

    await say("desfazer");
    expect(last()?.body).toContain("Não achei lançamento");
    const { data: after } = await admin
      .from("expenses")
      .select("status, confirmed_at")
      .eq("id", expense!.id)
      .single();
    expect(after?.status).toBe("confirmed");
    expect(new Date(after!.confirmed_at!).getTime()).toBe(
      new Date(confirmedAt).getTime(),
    );
  });

  it("auditoria: o bot grava quem lançou", async () => {
    const expense = await expenseByDescription("Servente antigo");
    const { data: rows } = await admin
      .from("audit_log")
      .select("action, user_id, diff")
      .eq("entity", "expenses")
      .eq("entity_id", expense!.id)
      .order("created_at");
    expect(rows?.length).toBeGreaterThanOrEqual(2);
    // Criação e confirmação pelo bot (sem sessão): autor é a Ana.
    expect(rows?.[0]).toMatchObject({ action: "create", user_id: ana.id });
    expect(rows?.[1]).toMatchObject({ user_id: ana.id });
  });

  it("resumo com duas obras e nenhuma ativa pergunta qual", async () => {
    const { data } = await ana.client
      .from("projects")
      .insert({ org_id: ana.orgId, name: "Galpão", created_by: ana.id })
      .select("id")
      .single();
    secondId = data!.id;
    await admin
      .from("whatsapp_conversations")
      .update({ active_project_id: null })
      .eq("user_id", ana.id);

    await say("resumo");
    expect(last()?.body).toBe("De qual obra você quer o resumo?");
    await tap(rowId("Galpão"));
    expect(last()?.body).toContain("*Resumo · Galpão*");

    await say("obras");
    expect(last()?.type).toBe("list");
    const message = last();
    const galpao =
      message?.type === "list"
        ? message.rows.find((row) => row.title === "Galpão")
        : undefined;
    expect(galpao?.description).toBe("Obra ativa");
    expect(secondId).toBeTruthy();
    expect(projectId).toBeTruthy();
  });

  it("cron: pendente com mais de 24 h vira cancelado e a conversa volta ao começo", async () => {
    extractExpense.mockResolvedValueOnce(read("Pendente esquecido"));
    await say("300 pedreiro");
    const pending = await expenseByDescription("Pendente esquecido");
    expect(pending?.status).toBe("pending");

    // Recente: não mexe.
    const { error: firstError } = await admin.rpc("expire_pending_expenses");
    expect(firstError).toBeNull();
    expect((await expenseByDescription("Pendente esquecido"))?.status).toBe(
      "pending",
    );

    // Envelhece só este lançamento (sem mexer nos outros dados do banco).
    await admin
      .from("expenses")
      .update({
        created_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
      })
      .eq("id", pending!.id);
    const { data: count, error } = await admin.rpc("expire_pending_expenses");
    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(1);
    expect((await expenseByDescription("Pendente esquecido"))?.status).toBe(
      "cancelled",
    );
    const { data: conversation } = await admin
      .from("whatsapp_conversations")
      .select("state, pending_expense_id")
      .eq("user_id", ana.id)
      .single();
    expect(conversation).toEqual({ state: "idle", pending_expense_id: null });
    // O cancelamento do cron fica na auditoria sem autor.
    const { data: audit } = await admin
      .from("audit_log")
      .select("user_id, diff")
      .eq("entity", "expenses")
      .eq("entity_id", pending!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(audit?.user_id).toBeNull();
    expect(audit?.diff).toMatchObject({ status: { to: "cancelled" } });
  });

  it("cron: limpa o conteúdo do log antigo e mantém o vínculo", async () => {
    const { data: row } = await admin
      .from("whatsapp_messages")
      .select("id, expense_id")
      .eq("from_phone", anaPhone)
      .not("expense_id", "is", null)
      .limit(1)
      .single();
    const { data: recent } = await admin
      .from("whatsapp_messages")
      .select("id")
      .eq("from_phone", anaPhone)
      .neq("id", row!.id)
      .limit(1)
      .single();
    await admin
      .from("whatsapp_messages")
      .update({
        created_at: new Date(Date.now() - 91 * 86400 * 1000).toISOString(),
      })
      .eq("id", row!.id);
    const { error } = await admin.rpc("purge_whatsapp_log");
    expect(error).toBeNull();
    const { data: after } = await admin
      .from("whatsapp_messages")
      .select("payload, expense_id")
      .eq("id", row!.id)
      .single();
    expect(after).toEqual({ payload: null, expense_id: row!.expense_id });
    // A mensagem recente continua com o conteúdo.
    const { data: kept } = await admin
      .from("whatsapp_messages")
      .select("payload")
      .eq("id", recent!.id)
      .single();
    expect(kept?.payload).not.toBeNull();
  });

  const lastIncoming = async () => {
    const { data } = await admin
      .from("whatsapp_messages")
      .select("error, processed_at")
      .eq("from_phone", anaPhone)
      .eq("direction", "in")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return data;
  };

  it("IA fora do ar: responde e anota no log", async () => {
    extractExpense.mockResolvedValueOnce({
      kind: "failed",
      reason: "unavailable",
      usage: null,
    });
    await say("300 pedreiro");
    expect(last()?.body).toContain("Não consegui lançar agora");
    expect(await lastIncoming()).toMatchObject({ error: "ai_unavailable" });
  });

  it("erro inesperado: avisa a pessoa e anota no log", async () => {
    extractExpense.mockRejectedValueOnce(new Error("banco caiu"));
    await say("300 pedreiro");
    expect(last()?.body).toContain("Algo deu errado do meu lado");
    const logged = await lastIncoming();
    expect(logged?.error).toContain("banco caiu");
    expect(logged?.processed_at).not.toBeNull();
  });

  it("Meta recusa a resposta: fica no log e o bot tenta avisar", async () => {
    failingSends = 1;
    await say("ajuda");
    expect(last()?.body).toContain("Algo deu errado do meu lado");
    const { data: out } = await admin
      .from("whatsapp_messages")
      .select("error")
      .eq("from_phone", anaPhone)
      .eq("direction", "out")
      .like("error", "send_failed%")
      .limit(1);
    expect(out?.length).toBe(1);
    expect((await lastIncoming())?.error).toContain("500");
  });

  it("rate limit: avisa uma vez e para de responder", async () => {
    const flooder = randomPhone();
    const old = Array.from({ length: 19 }, () => ({
      wa_message_id: `wamid.flood.${crypto.randomUUID()}`,
      direction: "in" as const,
      from_phone: flooder,
      type: "text",
    }));
    await admin.from("whatsapp_messages").insert(old);
    try {
      const flood = (body: string) =>
        handleIncomingMessage(admin, {
          id: `wamid.test.${crypto.randomUUID()}`,
          from: flooder,
          timestamp: `${Math.floor(Date.now() / 1000)}`,
          type: "text",
          text: { body },
        });
      // 20ª mensagem do minuto: ainda responde.
      await flood("oi");
      expect(last()?.body).toContain("ainda não está ligado");
      // 21ª: avisa do limite.
      await flood("oi de novo");
      expect(last()?.body).toContain("muitas mensagens");
      // 22ª: silêncio.
      const before = sent.length;
      await flood("e agora?");
      expect(sent.length).toBe(before);
    } finally {
      await admin.from("whatsapp_messages").delete().eq("from_phone", flooder);
    }
  });

  it("mensagens juntas: só o pendente mais novo fica", async () => {
    extractExpense
      .mockResolvedValueOnce(read("Junto A"))
      .mockResolvedValueOnce(read("Junto B"));
    await Promise.all([say("300 junto a"), say("300 junto b")]);
    const { data } = await admin
      .from("expenses")
      .select("status")
      .eq("org_id", ana.orgId)
      .in("description", ["Junto A", "Junto B"]);
    expect(data?.map((row) => row.status).sort()).toEqual([
      "cancelled",
      "pending",
    ]);
  });

  it("etapa apagada enquanto o bot pergunta o valor não trava", async () => {
    const { data: stage } = await admin
      .from("stages")
      .select("id")
      .eq("project_id", secondId)
      .eq("name", "Pintura")
      .single();
    extractExpense.mockResolvedValueOnce(
      read("Tinta", {
        amountCents: null,
        stageId: stage!.id,
        missing: ["amount"],
      }),
    );
    await say("comprei tinta");
    expect(last()?.body).toContain("Qual foi o valor de _Tinta_");
    const { error } = await ana.client
      .from("stages")
      .delete()
      .eq("id", stage!.id);
    expect(error).toBeNull();

    await say("150");
    const { data } = await admin
      .from("expenses")
      .select("status, stage_id, amount_cents")
      .eq("org_id", ana.orgId)
      .eq("description", "Tinta")
      .single();
    expect(data).toEqual({
      status: "pending",
      stage_id: null,
      amount_cents: 15000,
    });
  });

  it("quem perdeu o acesso depois de mandar não confirma", async () => {
    const bruno = await createTestUser("wa-cmd-bruno");
    const brunoPhone = randomPhone();
    try {
      await admin
        .from("profiles")
        .update({ whatsapp_phone: brunoPhone })
        .eq("id", bruno.id);
      await admin
        .from("organization_members")
        .insert({ org_id: ana.orgId, user_id: bruno.id, role: "member" });
      await admin.from("project_members").insert({
        org_id: ana.orgId,
        project_id: secondId,
        user_id: bruno.id,
        role: "editor",
      });

      extractExpense.mockResolvedValueOnce(read("Do Bruno"));
      await handleIncomingMessage(admin, {
        id: `wamid.test.${crypto.randomUUID()}`,
        from: brunoPhone,
        timestamp: `${Math.floor(Date.now() / 1000)}`,
        type: "text",
        text: { body: "300 pedreiro" },
      });
      const confirmId = rowId("Sem etapa");
      expect(confirmId).not.toBe("");

      // Vira "só acompanha" antes de tocar.
      await admin
        .from("project_members")
        .update({ role: "viewer" })
        .eq("project_id", secondId)
        .eq("user_id", bruno.id);
      await handleIncomingMessage(admin, {
        id: `wamid.test.${crypto.randomUUID()}`,
        from: brunoPhone,
        timestamp: `${Math.floor(Date.now() / 1000)}`,
        type: "interactive",
        interactive: {
          type: "list_reply",
          list_reply: { id: confirmId, title: "Sem etapa" },
        },
      });
      expect(last()?.body).toContain("já foi confirmado ou cancelado");
      const { data } = await admin
        .from("expenses")
        .select("status")
        .eq("description", "Do Bruno")
        .single();
      expect(data?.status).toBe("cancelled");
    } finally {
      await admin
        .from("whatsapp_messages")
        .delete()
        .eq("from_phone", brunoPhone);
      await deleteTestUsers([bruno]);
    }
  });

  it("as funções do cron não abrem para quem está logado", async () => {
    const expire = await ana.client.rpc("expire_pending_expenses");
    const purge = await ana.client.rpc("purge_whatsapp_log");
    expect(expire.error).not.toBeNull();
    expect(purge.error).not.toBeNull();
  });
});
