import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { OutgoingMessage } from "@/lib/whatsapp/client";

import {
  adminClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

vi.mock("server-only", () => ({}));

// Nada sai para a Meta: guarda para quem o bot mandaria e o quê.
const sent: { to: string; message: OutgoingMessage }[] = [];
vi.mock("@/lib/whatsapp/client", () => ({
  sendMessage: async (to: string, message: OutgoingMessage) => {
    sent.push({ to, message });
    return `wamid.out.${crypto.randomUUID()}`;
  },
}));

const { runNotifications } = await import("@/lib/whatsapp/notifications");

const randomPhone = () =>
  `55819${Math.floor(60000000 + Math.random() * 39999999)}`;
const recifeToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(
    new Date(),
  );
const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
/** Segunda-feira mais recente (hoje, se hoje é segunda), em Recife. */
const lastMonday = () => {
  const today = recifeToday();
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, -((weekday + 6) % 7));
};
/** Um dia que não é segunda (só alertas), no mês de hoje quase sempre. */
const notMonday = () => {
  const today = recifeToday();
  const day = lastMonday() === today ? addDays(today, 1) : today;
  return new Date(`${day}T15:00:00Z`);
};
const bodies = (to: string) =>
  sent
    .filter((item) => item.to === to)
    .map((item) => item.message.body.replace(/ /g, " "));

/**
 * Avisos pelo cron, contra o banco de verdade (envio simulado): alerta de
 * orçamento só quando o nível da etapa sobe, só para dono/admin com o aviso
 * ligado; resumo semanal às segundas, uma vez; tudo contado no plano.
 */
describe("avisos do WhatsApp (cron)", () => {
  const admin = adminClient();
  let ana: TestUser;
  let carla: TestUser;
  let anaPhone: string;
  let carlaPhone: string;
  let projectId: string;
  let alvenariaId: string;
  let materialId: string;
  const run = (now = new Date()) =>
    runNotifications(admin, now, { orgIds: [ana.orgId] });
  const templateUsage = async () => {
    const { data } = await admin
      .from("usage_counters")
      .select("template_messages")
      .eq("org_id", ana.orgId)
      .eq("month", `${recifeToday().slice(0, 7)}-01`)
      .maybeSingle();
    return data?.template_messages ?? 0;
  };
  const spend = async (amount: number, spentOn = recifeToday()) => {
    const { error } = await ana.client.from("expenses").insert({
      org_id: ana.orgId,
      project_id: projectId,
      stage_id: alvenariaId,
      category_id: materialId,
      description: "Tijolo",
      amount_cents: amount,
      spent_on: spentOn,
      status: "confirmed",
      created_by: ana.id,
    });
    if (error) throw error;
  };

  beforeAll(async () => {
    [ana, carla] = await Promise.all([
      createTestUser("wa-notif-ana"),
      createTestUser("wa-notif-carla"),
    ]);
    anaPhone = randomPhone();
    carlaPhone = randomPhone();

    const { data: categories } = await admin
      .from("categories")
      .select("id, code")
      .is("org_id", null);
    materialId = categories!.find((c) => c.code === "material")!.id;

    const { data: project, error } = await ana.client
      .from("projects")
      .insert({ org_id: ana.orgId, name: "Casa do lago", created_by: ana.id })
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
      .update({ budget_cents: 100_000 })
      .eq("id", alvenariaId);

    await admin
      .from("profiles")
      .update({ whatsapp_phone: anaPhone })
      .eq("id", ana.id);
    await admin
      .from("profiles")
      .update({ whatsapp_phone: carlaPhone })
      .eq("id", carla.id);
    // Carla só acompanha a obra: não recebe avisos.
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

  afterAll(async () => {
    await admin
      .from("whatsapp_messages")
      .delete()
      .in("from_phone", [anaPhone, carlaPhone]);
    await deleteTestUsers([carla, ana].filter(Boolean));
  });

  it("avisa quando a etapa passa de 80% e não repete", async () => {
    const before = await templateUsage();
    await spend(85_000);
    const day = notMonday();
    const summary = await run(day);
    expect(summary.alertsSent).toBe(1);
    expect(summary.reportsSent).toBe(0);
    expect(bodies(anaPhone).at(-1)).toContain(
      "a etapa Alvenaria já chegou a 85% do previsto (R$ 850,00 de R$ 1.000,00",
    );
    expect(bodies(carlaPhone)).toEqual([]);
    expect(await templateUsage()).toBe(before + 1);

    const { data: stored } = await admin
      .from("budget_alerts")
      .select("level")
      .eq("stage_id", alvenariaId)
      .single();
    expect(stored?.level).toBe("warn");

    // De novo, sem mudança: nada.
    const again = await run(day);
    expect(again.alertsSent).toBe(0);
  });

  it("avisa de novo ao passar de 100%", async () => {
    await spend(20_000);
    const day = notMonday();
    const summary = await run(day);
    expect(summary.alertsSent).toBe(1);
    expect(bodies(anaPhone).at(-1)).toContain("já chegou a 105% do previsto");
  });

  it("com o aviso desligado no perfil, não manda", async () => {
    // Previsto maior: a etapa volta para baixo de 80% e o aviso é esquecido.
    await ana.client
      .from("stages")
      .update({ budget_cents: 1_000_000 })
      .eq("id", alvenariaId);
    const day = notMonday();
    await run(day);
    const { data: forgotten } = await admin
      .from("budget_alerts")
      .select("level")
      .eq("stage_id", alvenariaId)
      .maybeSingle();
    expect(forgotten).toBeNull();

    // A pessoa desliga o aviso (pelo próprio cliente, como no app).
    const { error } = await ana.client
      .from("profiles")
      .update({ whatsapp_budget_alerts: false })
      .eq("id", ana.id);
    expect(error).toBeNull();
    await ana.client
      .from("stages")
      .update({ budget_cents: 100_000 })
      .eq("id", alvenariaId);
    const count = sent.length;
    const summary = await run(day);
    expect(summary.alertsSent).toBe(0);
    expect(sent.length).toBe(count);

    await ana.client
      .from("profiles")
      .update({ whatsapp_budget_alerts: true })
      .eq("id", ana.id);
  });

  it("resumo da semana na segunda, uma vez só", async () => {
    const monday = lastMonday();
    await spend(30_000, addDays(monday, -3));
    const at = new Date(`${monday}T15:00:00Z`);
    const summary = await run(at);
    expect(summary.reportsSent).toBe(1);
    const report = sent.find(
      (item) =>
        item.to === anaPhone &&
        item.message.type === "template" &&
        item.message.name === "resumo_semanal",
    );
    expect(report?.message.body).toContain(
      "Resumo da semana da obra Casa do lago",
    );
    expect(bodies(carlaPhone)).toEqual([]);

    // O cron rodou de novo no mesmo dia: não repete.
    const again = await run(at);
    expect(again.reportsSent).toBe(0);
  });

  it("ninguém de fora edita as preferências de outra pessoa", async () => {
    const { data } = await carla.client
      .from("profiles")
      .update({ whatsapp_weekly_report: false })
      .eq("id", ana.id)
      .select("id");
    expect(data ?? []).toEqual([]);
    const { data: row } = await admin
      .from("profiles")
      .select("whatsapp_weekly_report")
      .eq("id", ana.id)
      .single();
    expect(row?.whatsapp_weekly_report).toBe(true);
  });

  it("budget_alerts não é visível pelo app", async () => {
    const { data } = await ana.client.from("budget_alerts").select("stage_id");
    expect(data ?? []).toEqual([]);
  });
});
