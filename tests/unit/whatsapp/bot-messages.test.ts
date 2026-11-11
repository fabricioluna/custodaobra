import { describe, expect, it } from "vitest";

import { actionId, parseAction } from "@/lib/whatsapp/actions";
import {
  dateListMessage,
  editMenuMessage,
  formatSummary,
  invoiceButtonsMessage,
  parseAmountReply,
  paymentListMessage,
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

  it("cupom com vários itens mostra quantos", () => {
    expect(
      formatSummary(
        { ...base, description: "Cimento e areia", itemCount: 5 },
        "2026-11-09",
      ),
    ).toContain("Cimento e areia · 5 itens · hoje");
    expect(
      formatSummary({ ...base, itemCount: 1 }, "2026-11-09"),
    ).not.toContain("itens");
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

  it("na primeira pergunta, até 7 etapas numa página, com Sem etapa, Editar e Cancelar", () => {
    const rows = rowsOf(
      stageListMessage({
        body: "x",
        mode: "confirm",
        stages: stages(7),
        page: 0,
        expenseId: EXPENSE,
      }),
    );
    expect(rows).toHaveLength(10);
    expect(rows.slice(-3).map((r) => r.title)).toEqual([
      "Sem etapa",
      "Editar lançamento",
      "Cancelar lançamento",
    ]);
    expect(parseAction(rows.at(-2)?.id)).toEqual({
      type: "edit",
      expenseId: EXPENSE,
    });
  });

  it("ao editar a etapa, até 8 numa página, sem a opção Editar", () => {
    const rows = rowsOf(
      stageListMessage({
        body: "x",
        mode: "edit",
        stages: stages(8),
        page: 0,
        expenseId: EXPENSE,
      }),
    );
    expect(rows).toHaveLength(10);
    expect(rows.map((r) => r.title)).not.toContain("Editar lançamento");
  });

  it("13 etapas (o padrão) em páginas de 6, sem passar de 10 opções", () => {
    const page = (n: number) =>
      rowsOf(
        stageListMessage({
          body: "x",
          mode: "confirm",
          stages: stages(13),
          page: n,
          expenseId: EXPENSE,
        }),
      );
    const first = page(0);
    expect(first).toHaveLength(10);
    expect(first[6]?.title).toBe("Mais etapas");
    expect(parseAction(first[6]?.id)).toMatchObject({ page: 1 });

    const last = page(2);
    expect(last.map((r) => r.title)).toContain("Etapa 13");
    expect(last.find((r) => r.title === "Voltar ao início")).toBeTruthy();
    for (const n of [0, 1, 2]) expect(page(n).length).toBeLessThanOrEqual(10);
  });
});

describe("menus do Editar", () => {
  it("menu com os campos novos e Obra só quando há outra obra", () => {
    const titles = (canMove: boolean) => {
      const message = editMenuMessage(EXPENSE, { canMove });
      return message.type === "list" ? message.rows.map((r) => r.title) : [];
    };
    expect(titles(false)).toEqual([
      "Valor",
      "Etapa",
      "Categoria",
      "Data",
      "Descrição",
      "Fornecedor",
      "Forma de pagamento",
      "Nota fiscal",
    ]);
    expect(titles(true).at(-1)).toBe("Obra");
  });

  it("ids das opções novas vão e voltam", () => {
    const PROJECT = "22222222-3333-4444-8555-666666666666";
    expect(parseAction(actionId.payment("pix", EXPENSE))).toEqual({
      type: "payment",
      method: "pix",
      expenseId: EXPENSE,
    });
    expect(parseAction(actionId.payment(null, EXPENSE))).toMatchObject({
      method: null,
    });
    expect(parseAction(actionId.invoice(false, EXPENSE))).toEqual({
      type: "invoice",
      hasInvoice: false,
      expenseId: EXPENSE,
    });
    expect(parseAction(actionId.move(PROJECT, EXPENSE))).toEqual({
      type: "move",
      projectId: PROJECT,
      expenseId: EXPENSE,
    });
    expect(parseAction(actionId.editField("supplier", EXPENSE))).toEqual({
      type: "edit_field",
      field: "supplier",
      expenseId: EXPENSE,
    });
  });

  it("formas de pagamento cabem na lista", () => {
    const message = paymentListMessage(EXPENSE);
    const rows = message.type === "list" ? message.rows : [];
    expect(rows.length).toBeLessThanOrEqual(10);
    expect(rows.every((r) => r.title.length <= 24)).toBe(true);
    expect(rows.at(-1)?.title).toBe("Não informar");
  });

  it("nota com dois botões", () => {
    const message = invoiceButtonsMessage(EXPENSE);
    expect(message.type === "buttons" ? message.buttons.length : 0).toBe(2);
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
    // Resposta falada (transcrição) ou escrita com palavras em volta.
    ["Foi 350 reais.", "350"],
    ["deu 1.200", "1.200"],
    ["O valor é R$ 89,90", "89,90"],
    ["paguei 300 conto", "300"],
  ])("%j → %j", (text, expected) => {
    expect(parseAmountReply(text)).toBe(expected);
  });

  it("texto que não é só valor fica de fora (vira gasto novo)", () => {
    expect(parseAmountReply("500 eletricista")).toBeNull();
    expect(parseAmountReply("oi")).toBeNull();
    expect(parseAmountReply("paguei 300 de areia")).toBeNull();
  });
});
