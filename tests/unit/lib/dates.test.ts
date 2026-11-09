import { describe, expect, it } from "vitest";

import {
  addDays,
  formatDate,
  formatMonth,
  formatRelativeDate,
  isIsoDate,
  todayIn,
} from "@/lib/dates";

describe("todayIn", () => {
  // 02:30 UTC do dia 9 ainda é dia 8 em Recife (UTC-3).
  const now = new Date("2026-11-09T02:30:00Z");

  it("usa o fuso da organização, não o do servidor", () => {
    expect(todayIn("America/Recife", now)).toBe("2026-11-08");
    expect(todayIn("UTC", now)).toBe("2026-11-09");
  });

  it("usa Recife por padrão", () => {
    expect(todayIn(undefined, now)).toBe("2026-11-08");
  });
});

describe("addDays", () => {
  it("vira mês e ano", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("isIsoDate", () => {
  it("aceita só datas que existem", () => {
    expect(isIsoDate("2026-11-08")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("08/11/2026")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("formatação", () => {
  it("formatDate", () => {
    expect(formatDate("2026-11-08")).toBe("08/11/2026");
  });

  it("formatMonth", () => {
    expect(formatMonth("2026-11-01")).toBe("nov/2026");
  });

  it("formatRelativeDate", () => {
    expect(formatRelativeDate("2026-11-08", "2026-11-08")).toBe("hoje");
    expect(formatRelativeDate("2026-11-07", "2026-11-08")).toBe("ontem");
    expect(formatRelativeDate("2026-10-01", "2026-11-08")).toBe("01/10/2026");
  });
});
