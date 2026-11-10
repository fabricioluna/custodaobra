import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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
vi.mock("@/lib/ai/extract-expense", () => ({ extractExpense }));

const { handleIncomingMessage } =
  await import("@/lib/whatsapp/handlers/incoming");

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(
    new Date(),
  );

const read = (description: string): ExtractionResult => ({
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

  it("as funções do cron não abrem para quem está logado", async () => {
    const expire = await ana.client.rpc("expire_pending_expenses");
    const purge = await ana.client.rpc("purge_whatsapp_log");
    expect(expire.error).not.toBeNull();
    expect(purge.error).not.toBeNull();
  });
});
