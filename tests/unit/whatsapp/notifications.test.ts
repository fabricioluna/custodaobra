import { describe, expect, it, vi } from "vitest";

import { stageStatus } from "@/features/stages/budget";
import {
  alertDecision,
  budgetAlertParams,
  hasWeeklyNews,
  isMonday,
  previousWeek,
  weeklyReportParams,
} from "@/lib/whatsapp/notification-rules";
import {
  renderTemplate,
  TEMPLATES,
  templateMessage,
  templateParam,
} from "@/lib/whatsapp/templates";

vi.mock("server-only", () => ({}));

const { buildMessageBody } = await import("@/lib/whatsapp/client");
const { checkTemplateMessages } = await import("@/lib/billing/limits");

const nbsp = (text: string) => text.replace(/ /g, " ");

describe("alertDecision", () => {
  it.each([
    // nível de hoje, último aviso → avisa?, guarda
    ["ok", null, false, null],
    ["none", null, false, null],
    ["warn", null, true, "warn"],
    ["warn", "warn", false, "warn"],
    ["over", null, true, "over"],
    ["over", "warn", true, "over"],
    ["over", "over", false, "over"],
    // Voltou de 100% para 80%: guarda sem avisar.
    ["warn", "over", false, "warn"],
    // Abaixo de 80%: esquece, para avisar de novo num próximo estouro.
    ["ok", "over", false, null],
  ] as const)("%s depois de %s", (current, notified, notify, store) => {
    expect(alertDecision(current, notified)).toEqual({ notify, store });
  });
});

describe("parâmetros dos modelos", () => {
  it("alerta de orçamento", () => {
    const plan = {
      budgetCents: 2_000_000,
      spentCents: 1_500_000,
      committedCents: 200_000,
      progressPercent: 50,
    };
    const params = budgetAlertParams({
      projectName: "Casa nova",
      stageName: "Alvenaria",
      status: stageStatus(plan),
      usedCents: 1_700_000,
      budgetCents: 2_000_000,
    }).map(nbsp);
    expect(params).toEqual([
      "Casa nova",
      "Alvenaria",
      "85%",
      "R$ 17.000,00",
      "R$ 20.000,00",
    ]);
  });

  it("resumo semanal com contas atrasadas e a vencer", () => {
    const params = weeklyReportParams({
      projectName: "Casa nova",
      weekSpentCents: 345_000,
      weekCount: 12,
      constructionCents: 8_430_000,
      upcomingCents: 120_000,
      overdueCents: 50_000,
    }).map(nbsp);
    expect(params).toEqual([
      "Casa nova",
      "R$ 3.450,00",
      "12 gastos",
      "R$ 84.300,00",
      "Contas atrasadas: R$ 500,00. Contas nos próximos 7 dias: R$ 1.200,00.",
    ]);
  });

  it("resumo semanal sem contas", () => {
    const params = weeklyReportParams({
      projectName: "Casa",
      weekSpentCents: 30_000,
      weekCount: 1,
      constructionCents: 30_000,
      upcomingCents: 0,
      overdueCents: 0,
    });
    expect(params[2]).toBe("1 gasto");
    expect(params[4]).toBe("Nenhuma conta a vencer nos próximos 7 dias.");
  });

  it("semana sem gasto e sem conta não manda nada", () => {
    const quiet = {
      projectName: "Casa",
      weekSpentCents: 0,
      weekCount: 0,
      constructionCents: 100_000,
      upcomingCents: 0,
      overdueCents: 0,
    };
    expect(hasWeeklyNews(quiet)).toBe(false);
    expect(hasWeeklyNews({ ...quiet, overdueCents: 1 })).toBe(true);
    expect(hasWeeklyNews({ ...quiet, weekCount: 1 })).toBe(true);
  });
});

describe("semana", () => {
  it("segunda-feira e a semana anterior", () => {
    expect(isMonday("2026-11-16")).toBe(true);
    expect(isMonday("2026-11-15")).toBe(false);
    expect(previousWeek("2026-11-16")).toEqual({
      from: "2026-11-09",
      to: "2026-11-15",
    });
  });
});

describe("modelos", () => {
  it("parâmetros nem no começo nem no fim do texto (regra da Meta)", () => {
    for (const template of Object.values(TEMPLATES)) {
      expect(template.text).not.toMatch(/^\{\{/);
      expect(template.text).not.toMatch(/\}\}\.?$/);
      const count = template.text.match(/\{\{\d+\}\}/g)?.length ?? 0;
      expect(template.example).toHaveLength(count);
      expect(template.name).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it("parâmetro em uma linha, sem espaços seguidos e nunca vazio", () => {
    expect(templateParam("Casa\nnova\t  da praia")).toBe("Casa nova da praia");
    expect(templateParam("   ")).toBe("-");
  });

  it("monta o texto para o log", () => {
    expect(renderTemplate("Obra {{1}}: {{2}}.", ["Casa", "ok"])).toBe(
      "Obra Casa: ok.",
    );
    const message = templateMessage("budgetAlert", [
      ...TEMPLATES.budgetAlert.example,
    ]);
    expect(message.body).toContain("a etapa Alvenaria já chegou a 85%");
    expect(message.language).toBe("pt_BR");
  });

  it("corpo da chamada para a Meta", () => {
    const message = templateMessage("weeklyReport", [
      ...TEMPLATES.weeklyReport.example,
    ]);
    expect(buildMessageBody("5581", message)).toMatchObject({
      to: "5581",
      type: "template",
      template: {
        name: "resumo_semanal",
        language: { code: "pt_BR" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Casa nova" },
              { type: "text", text: "R$ 3.450,00" },
              { type: "text", text: "12 gastos" },
              { type: "text", text: "R$ 84.300,00" },
              {
                type: "text",
                text: "Contas nos próximos 7 dias: R$ 1.200,00.",
              },
            ],
          },
        ],
      },
    });
  });
});

describe("checkTemplateMessages", () => {
  const plan = { whatsapp_enabled: true, max_template_messages_month: 60 };

  it("até o teto do mês, contando o lote inteiro", () => {
    expect(checkTemplateMessages(plan, 58, 2)).toEqual({ ok: true });
    expect(checkTemplateMessages(plan, 59, 2)).toEqual({
      ok: false,
      reason: "max_template_messages",
      limit: 60,
    });
  });

  it("WhatsApp desligado no plano barra", () => {
    expect(
      checkTemplateMessages({ ...plan, whatsapp_enabled: false }, 0),
    ).toEqual({ ok: false, reason: "whatsapp_disabled" });
  });
});
