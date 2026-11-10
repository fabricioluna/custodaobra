import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { hashLinkCode } from "@/lib/whatsapp/link-code";
import { phoneVariants } from "@/lib/whatsapp/phone";
import type { IncomingMessage } from "@/lib/whatsapp/webhook";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

vi.mock("server-only", () => ({}));

// Nada sai para a Meta: o envio é trocado por um registro do que seria mandado.
const sent: { to: string; body: string }[] = [];
vi.mock("@/lib/whatsapp/client", () => ({
  markReadWithTyping: async () => {},
  sendMessage: async (to: string, message: { body: string }) => {
    sent.push({ to, body: message.body });
    return `wamid.out.${crypto.randomUUID()}`;
  },
}));

const SECRET = "segredo-de-teste-dos-codigos";
process.env.WHATSAPP_LINK_CODE_SECRET = SECRET;

const { handleIncomingMessage } =
  await import("@/lib/whatsapp/handlers/incoming");

/** Celular aleatório no formato do wa_id (com o nono dígito). */
const randomPhone = () =>
  `55819${Math.floor(60000000 + Math.random() * 39999999)}`;

const textMessage = (from: string, body: string): IncomingMessage => ({
  id: `wamid.test.${crypto.randomUUID()}`,
  from,
  timestamp: `${Math.floor(Date.now() / 1000)}`,
  type: "text",
  text: { body },
});

/**
 * WhatsApp: cada pessoa só mexe nos próprios códigos; log, conversas e as
 * funções do bot ficam fora do alcance de usuários; o uso do plano é visível
 * só para dono e admin da própria conta. E o fluxo de ligar o número, do
 * jeito que o webhook roda (service_role), com mensagem repetida e tentativas
 * erradas.
 */
describe("WhatsApp (RLS e vínculo)", () => {
  const admin = adminClient();
  let ana: TestUser;
  let bruno: TestUser;
  const phones: string[] = [];

  /** Código gerado como a tela faz (cliente logado), devolvido em texto. */
  const newCode = async (user: TestUser) => {
    const code = `${Math.floor(100000 + Math.random() * 899999)}`;
    const { error } = await user.client
      .from("whatsapp_link_codes")
      .insert({ user_id: user.id, code_hash: hashLinkCode(code, SECRET) });
    if (error) throw error;
    return code;
  };

  const phoneOf = async (user: TestUser) => {
    const { data } = await admin
      .from("profiles")
      .select("whatsapp_phone")
      .eq("id", user.id)
      .single();
    return data?.whatsapp_phone ?? null;
  };

  beforeAll(async () => {
    ana = await createTestUser("wa-ana");
    bruno = await createTestUser("wa-bruno");
  });

  afterAll(async () => {
    if (phones.length) {
      await admin.from("whatsapp_messages").delete().in("from_phone", phones);
    }
    await deleteTestUsers([ana, bruno].filter(Boolean));
  });

  describe("códigos de vínculo", () => {
    it("cada um gera e vê só os próprios", async () => {
      await newCode(ana);
      const { data: own } = await ana.client
        .from("whatsapp_link_codes")
        .select("id");
      expect(own?.length).toBeGreaterThan(0);

      const { data: other } = await bruno.client
        .from("whatsapp_link_codes")
        .select("id")
        .eq("user_id", ana.id);
      expect(other).toEqual([]);
    });

    it("ninguém gera código em nome de outro", async () => {
      const { error } = await bruno.client.from("whatsapp_link_codes").insert({
        user_id: ana.id,
        code_hash: hashLinkCode("111111", SECRET),
      });
      expect(error).not.toBeNull();
    });

    it("validade e uso não mudam pelo app", async () => {
      const { error } = await ana.client
        .from("whatsapp_link_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("user_id", ana.id);
      expect(error).not.toBeNull();

      const { error: insertError } = await ana.client
        .from("whatsapp_link_codes")
        .insert({
          user_id: ana.id,
          code_hash: hashLinkCode("222222", SECRET),
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        });
      expect(insertError).not.toBeNull();
    });

    it("visitante não vê nem cria códigos", async () => {
      const anon = anonClient();
      const { data } = await anon.from("whatsapp_link_codes").select("id");
      expect(data ?? []).toEqual([]);
      const { error } = await anon.from("whatsapp_link_codes").insert({
        user_id: ana.id,
        code_hash: hashLinkCode("333333", SECRET),
      });
      expect(error).not.toBeNull();
    });
  });

  describe("tabelas e funções do bot", () => {
    it("usuário não lê log nem conversas", async () => {
      const messages = await ana.client.from("whatsapp_messages").select("id");
      expect(messages.data ?? []).toEqual([]);
      const conversations = await ana.client
        .from("whatsapp_conversations")
        .select("user_id");
      expect(conversations.data ?? []).toEqual([]);
    });

    it("usuário não liga número nem soma uso direto", async () => {
      const code = await newCode(ana);
      const link = await ana.client.rpc("link_whatsapp", {
        p_code_hash: hashLinkCode(code, SECRET),
        p_phone: "5581999990000",
        p_phone_variants: ["5581999990000"],
      });
      expect(link.error).not.toBeNull();

      const usage = await ana.client.rpc("increment_usage", {
        p_org_id: ana.orgId,
        p_month: "2026-11-01",
        p_ai_calls: 1,
      });
      expect(usage.error).not.toBeNull();
    });

    it("uso do plano: só a própria conta vê", async () => {
      const { error } = await admin.rpc("increment_usage", {
        p_org_id: ana.orgId,
        p_month: "2026-11-15",
        p_whatsapp_entries: 1,
        p_ai_calls: 2,
        p_ai_input_tokens: 100,
        p_ai_output_tokens: 20,
      });
      expect(error).toBeNull();
      await admin.rpc("increment_usage", {
        p_org_id: ana.orgId,
        p_month: "2026-11-01",
        p_ai_calls: 1,
      });

      const { data: own } = await ana.client
        .from("usage_counters")
        .select("month, whatsapp_entries, ai_calls, ai_input_tokens")
        .eq("org_id", ana.orgId);
      expect(own).toEqual([
        {
          month: "2026-11-01",
          whatsapp_entries: 1,
          ai_calls: 3,
          ai_input_tokens: 100,
        },
      ]);

      const { data: other } = await bruno.client
        .from("usage_counters")
        .select("org_id")
        .eq("org_id", ana.orgId);
      expect(other).toEqual([]);

      const { error: writeError } = await ana.client
        .from("usage_counters")
        .update({ ai_calls: 0 })
        .eq("org_id", ana.orgId);
      const { data: after } = await admin
        .from("usage_counters")
        .select("ai_calls")
        .eq("org_id", ana.orgId)
        .single();
      expect(writeError !== null || after?.ai_calls === 3).toBe(true);
      expect(after?.ai_calls).toBe(3);
    });
  });

  describe("ligar o número pelo bot", () => {
    it("número desconhecido recebe só o link de cadastro", async () => {
      const phone = randomPhone();
      phones.push(phone);
      sent.length = 0;
      await handleIncomingMessage(admin, textMessage(phone, "300 pedreiro"));
      expect(sent).toHaveLength(1);
      expect(sent[0]?.body).toContain("/entrar");
    });

    it("VINCULAR liga o número e a mensagem repetida não faz nada", async () => {
      const phone = randomPhone();
      phones.push(phone);
      const code = await newCode(ana);
      const message = textMessage(phone, `VINCULAR ${code}`);

      sent.length = 0;
      await handleIncomingMessage(admin, message);
      expect(await phoneOf(ana)).toBe(phone);
      expect(sent).toHaveLength(1);
      expect(sent[0]?.body).toContain("Pronto");

      // A Meta reenvia a mesma mensagem: nada novo acontece.
      await handleIncomingMessage(admin, message);
      expect(sent).toHaveLength(1);
      const { count } = await admin
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("wa_message_id", message.id);
      expect(count).toBe(1);

      // O código já foi usado.
      sent.length = 0;
      await handleIncomingMessage(
        admin,
        textMessage(phone, `VINCULAR ${code}`),
      );
      expect(sent[0]?.body).toContain("não vale");
      expect(await phoneOf(ana)).toBe(phone);

      // Ana já ligada (sem obra): mensagem comum não recebe o cadastro.
      sent.length = 0;
      await handleIncomingMessage(admin, textMessage(phone, "300 pedreiro"));
      expect(sent[0]?.body).toContain("não tem uma obra");
    });

    it("o mesmo celular, sem o nono dígito, é a mesma pessoa", async () => {
      const phone = await phoneOf(ana);
      if (!phone) throw new Error("Ana sem número");
      const old = phoneVariants(phone)[1];
      if (!old) throw new Error("sem variante");
      phones.push(old);
      sent.length = 0;
      await handleIncomingMessage(admin, textMessage(old, "oi"));
      expect(sent[0]?.body).toContain("não tem uma obra");
    });

    it("o número passa para quem ligou por último", async () => {
      const phone = await phoneOf(ana);
      if (!phone) throw new Error("Ana sem número");
      const code = await newCode(bruno);
      await handleIncomingMessage(
        admin,
        textMessage(phone, `VINCULAR ${code}`),
      );
      expect(await phoneOf(bruno)).toBe(phone);
      expect(await phoneOf(ana)).toBeNull();
    });

    it("cada um desliga só o próprio número", async () => {
      const { error } = await ana.client.rpc("unlink_whatsapp");
      expect(error).toBeNull();
      expect(await phoneOf(bruno)).not.toBeNull();

      await bruno.client.rpc("unlink_whatsapp");
      expect(await phoneOf(bruno)).toBeNull();

      const anon = await anonClient().rpc("unlink_whatsapp");
      expect(anon.error).not.toBeNull();
    });

    it("depois de 5 códigos errados por hora, para de conferir", async () => {
      const phone = randomPhone();
      phones.push(phone);
      for (let i = 0; i < 5; i++) {
        await handleIncomingMessage(
          admin,
          textMessage(phone, "VINCULAR 000000"),
        );
      }
      // Agora, nem o código certo liga.
      const code = await newCode(ana);
      sent.length = 0;
      await handleIncomingMessage(
        admin,
        textMessage(phone, `VINCULAR ${code}`),
      );
      expect(sent[0]?.body).toContain("Muitas tentativas");
      expect(await phoneOf(ana)).toBeNull();
    });
  });
});
