import { describe, expect, it } from "vitest";

import { actionId, parseAction } from "@/lib/whatsapp/actions";
import {
  dateListMessage,
  formatSummary,
  parseAmountReply,
  stageListMessage,
  summaryMessage,
} from "@/lib/whatsapp/messages";

const EXPENSE = "11111111-2222-4333-8444-555555555555";
const STAGE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("ids dos botões", () => {
  it("vai e volta sem perder nada", () => {
    expect(parseAction(actionId.confirm(EXPENSE))).toEqual({
      type: "confirm",
      expenseId: EXPENSE,
    });
    expect(parseAction(actionId.stage("confirm", STAGE, EXPENSE))).toEqual({
      type: "stage",
      mode: "confirm",
      stageId: STAGE,
      expenseId: EXPENSE,
    });
    expect(parseAction(actionId.stage("edit", null, EXPENSE))).toEqual({
      type: "stage",
      mode: "edit",
      stageId: null,
      expenseId: EXPENSE,
    });
    expect(parseAction(actionId.stagePage("edit", 1, EXPENSE))).toEqual({
      type: "stage_page",
      mode: "edit",
      page: 1,
      expenseId: EXPENSE,
    });
    expect(parseAction(actionId.editField("amount", EXPENSE))).toEqual({
      type: "edit_field",
      field: "amount",
      expenseId: EXPENSE,
    });
    expect(parseAction(actionId.category("mao_de_obra", EXPENSE))).toEqual({
      type: "category",
      code: "mao_de_obra",
      expenseId: EXPENSE,
    });
    expect(parseAction(actionId.date("2026-11-08", EXPENSE))).toEqual({
      type: "date",
      date: "2026-11-08",
      expenseId: EXPENSE,
    });
    expect(parseAction(actionId.project(STAGE))).toEqual({
      type: "project",
      projectId: STAGE,
    });
  });

  it("recusa ids que não são nossos ou foram alterados", () => {
    for (const id of [
      "",
      null,
      "Confirmar",
      `c:${EXPENSE}x`,
      "c:not-a-uuid",
      `ef:valor:${EXPENSE}`,
      `ca:DROP TABLE:${EXPENSE}`,
    ]) {
      expect(parseAction(id)).toBeNull();
    }
  });

  it("cabe no limite de 256 caracteres", () => {
    expect(actionId.stage("confirm", STAGE, EXPENSE).length).toBeLessThan(256);
  });
});

describe("resumo do lançamento", () => {
  const base = {
    amountCents: 30000,
    categoryCode: "mao_de_obra",
    stageName: "Alvenaria",
    description: "Pedreiro",
    supplierName: null,
    spentOn: "2026-11-09",
    paymentMethod: null,
    hasInvoice: false,
    projectName: "Casa nova",
  };

  it("no formato da seção 6 do CLAUDE.md", () => {
    expect(formatSummary(base, "2026-11-09")).toBe(
      "*R$ 300,00* · Mão de obra · Alvenaria · Pedreiro · hoje · sem nota\nObra: Casa nova",
    );
  });

  it("com fornecedor, pagamento, nota e sem etapa", () => {
    expect(
      formatSummary(
        {
          ...base,
          stageName: null,
          supplierName: "Loja do Zé",
          spentOn: "2026-11-08",
          paymentMethod: "pix",
          hasInvoice: true,
        },
        "2026-11-09",
      ),
    ).toContain("Sem etapa · Pedreiro · Loja do Zé · ontem · pix · com nota");
  });

  it("três botões: Confirmar, Editar, Cancelar", () => {
    const message = summaryMessage("x", EXPENSE);
    expect(
      message.type === "buttons" && message.buttons.map((b) => b.title),
    ).toEqual(["Confirmar", "Editar", "Cancelar"]);
  });
});

describe("lista de etapas", () => {
  const stages = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${String(i).padStart(8, "0")}-bbbb-4ccc-8ddd-eeeeeeeeeeee`,
      name: `Etapa ${i + 1}`,
    }));
  const rowsOf = (message: ReturnType<typeof stageListMessage>) =>
    message.type === "list" ? message.rows : [];

  it("até 8 etapas numa página só, com Sem etapa e Cancelar", () => {
    const rows = rowsOf(
      stageListMessage({
        body: "x",
        mode: "confirm",
        stages: stages(8),
        page: 0,
        expenseId: EXPENSE,
      }),
    );
    expect(rows).toHaveLength(10);
    expect(rows.at(-2)?.title).toBe("Sem etapa");
    expect(rows.at(-1)?.title).toBe("Cancelar lançamento");
  });

  it("13 etapas (o padrão) em páginas de 7, sem passar de 10 opções", () => {
    const first = rowsOf(
      stageListMessage({
        body: "x",
        mode: "confirm",
        stages: stages(13),
        page: 0,
        expenseId: EXPENSE,
      }),
    );
    expect(first).toHaveLength(10);
    expect(first[7]?.title).toBe("Mais etapas");
    expect(parseAction(first[7]?.id)).toMatchObject({ page: 1 });

    const second = rowsOf(
      stageListMessage({
        body: "x",
        mode: "confirm",
        stages: stages(13),
        page: 1,
        expenseId: EXPENSE,
      }),
    );
    expect(second.map((r) => r.title)).toContain("Etapa 13");
    expect(second.find((r) => r.title === "Voltar ao início")).toBeTruthy();
    expect(second.length).toBeLessThanOrEqual(10);
  });
});

describe("lista de dias", () => {
  it("hoje, ontem e os 5 dias antes", () => {
    const message = dateListMessage("2026-11-09", EXPENSE);
    const rows = message.type === "list" ? message.rows : [];
    expect(rows.map((r) => r.title).slice(0, 3)).toEqual([
      "Hoje",
      "Ontem",
      "sáb, 07/11/2026",
    ]);
    expect(rows).toHaveLength(7);
  });
});

describe("parseAmountReply", () => {
  it.each([
    ["300", "300"],
    ["R$ 1.250,50", "1.250,50"],
    ["300 reais", "300"],
    [" 450 ", "450"],
  ])("%j → %j", (text, expected) => {
    expect(parseAmountReply(text)).toBe(expected);
  });

  it("texto que não é só valor fica de fora (vira gasto novo)", () => {
    expect(parseAmountReply("500 eletricista")).toBeNull();
    expect(parseAmountReply("oi")).toBeNull();
  });
});
