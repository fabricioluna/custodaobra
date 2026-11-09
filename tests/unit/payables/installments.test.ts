import { describe, expect, it } from "vitest";

import {
  dueState,
  splitInstallments,
  summarizeOpen,
} from "@/features/payables/installments";
import { addMonths, daysBetween } from "@/lib/dates";

describe("addMonths", () => {
  it("soma meses e vira o ano", () => {
    expect(addMonths("2026-11-10", 1)).toBe("2026-12-10");
    expect(addMonths("2026-11-10", 2)).toBe("2027-01-10");
    expect(addMonths("2026-11-10", 0)).toBe("2026-11-10");
  });

  it("usa o último dia quando o dia não existe no mês", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2027-01-31", 2)).toBe("2027-03-31");
  });
});

describe("daysBetween", () => {
  it("conta os dias, negativo para trás", () => {
    expect(daysBetween("2026-11-09", "2026-11-09")).toBe(0);
    expect(daysBetween("2026-11-09", "2026-12-01")).toBe(22);
    expect(daysBetween("2026-11-09", "2026-11-06")).toBe(-3);
  });
});

describe("splitInstallments", () => {
  it("à vista é uma parcela só", () => {
    expect(splitInstallments(150_000, 1, "2026-12-10")).toEqual([
      { number: 1, dueDate: "2026-12-10", amountCents: 150_000 },
    ]);
  });

  it("divide igual quando dá e vence um mês depois do outro", () => {
    expect(splitInstallments(150_000, 3, "2026-12-10")).toEqual([
      { number: 1, dueDate: "2026-12-10", amountCents: 50_000 },
      { number: 2, dueDate: "2027-01-10", amountCents: 50_000 },
      { number: 3, dueDate: "2027-02-10", amountCents: 50_000 },
    ]);
  });

  it("os centavos que sobram vão para a primeira, e a soma bate", () => {
    const parts = splitInstallments(100_000, 3, "2026-12-10");
    expect(parts.map((p) => p.amountCents)).toEqual([33_334, 33_333, 33_333]);
    expect(parts.reduce((sum, p) => sum + p.amountCents, 0)).toBe(100_000);
  });

  it("recusa número de parcelas inválido", () => {
    expect(() => splitInstallments(1000, 0, "2026-12-10")).toThrow();
    expect(() => splitInstallments(1000, 1.5, "2026-12-10")).toThrow();
  });
});

describe("dueState", () => {
  const today = "2026-11-09";
  it("classifica o vencimento em relação a hoje", () => {
    expect(dueState("2026-11-08", today)).toBe("overdue");
    expect(dueState("2026-11-09", today)).toBe("today");
    expect(dueState("2026-11-16", today)).toBe("soon");
    expect(dueState("2026-11-17", today)).toBe("later");
  });
});

describe("summarizeOpen", () => {
  it("soma o atrasado, o que vence em 7 dias e o total", () => {
    expect(
      summarizeOpen(
        [
          { amount_cents: 100, due_date: "2026-11-01" },
          { amount_cents: 200, due_date: "2026-11-05" },
          { amount_cents: 300, due_date: "2026-11-09" },
          { amount_cents: 400, due_date: "2026-11-12" },
          { amount_cents: 500, due_date: "2026-12-30" },
        ],
        "2026-11-09",
      ),
    ).toEqual({
      overdueCents: 300,
      overdueCount: 2,
      soonCents: 700,
      totalCents: 1500,
    });
  });
});
