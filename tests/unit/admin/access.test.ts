import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  accessDate,
  accessFormDefaults,
  accessFormSchema,
  accessLabel,
  accessOverrideAt,
} = await import("@/features/admin/access");
const { startOfDayIn } = await import("@/lib/dates");

describe("startOfDayIn", () => {
  it("meia-noite no fuso da conta, em UTC", () => {
    expect(startOfDayIn("2026-12-01", "America/Recife")).toBe(
      "2026-12-01T03:00:00.000Z",
    );
    expect(startOfDayIn("2026-12-01", "UTC")).toBe("2026-12-01T00:00:00.000Z");
    expect(startOfDayIn("2026-07-01", "America/New_York")).toBe(
      "2026-07-01T04:00:00.000Z",
    );
  });

  it("acerta o dia em que o horário de verão muda à meia-noite local", () => {
    // Beirute adianta o relógio às 00:00 de 29/03/2026 (22:00 UTC do dia 28).
    expect(startOfDayIn("2026-03-29", "Asia/Beirut")).toBe(
      "2026-03-28T22:00:00.000Z",
    );
  });
});

describe("acesso decidido pela equipe", () => {
  it("liberar até D vale até o fim de D; bloquear a partir de D, desde o começo", () => {
    expect(accessOverrideAt("free", "2026-12-01")).toBe(
      "2026-12-02T03:00:00.000Z",
    );
    expect(accessOverrideAt("blocked", "2026-12-01")).toBe(
      "2026-12-01T03:00:00.000Z",
    );
    expect(accessOverrideAt("free", "")).toBeNull();
    expect(accessOverrideAt("blocked", "")).toBeNull();
    expect(accessOverrideAt("normal", "2026-12-01")).toBeNull();
  });

  it("a data guardada volta como o dia escolhido", () => {
    expect(accessDate("free", "2026-12-02T03:00:00.000Z")).toBe("2026-12-01");
    expect(accessDate("blocked", "2026-12-01T03:00:00.000Z")).toBe(
      "2026-12-01",
    );
  });

  it("etiquetas da lista", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    expect(accessLabel(null, null, now).tone).toBe("normal");
    expect(accessLabel("free", null, now).text).toBe("Liberada sem prazo");
    expect(accessLabel("free", "2026-12-02T03:00:00.000Z", now).text).toBe(
      "Liberada até 01/12/2026",
    );
    expect(accessLabel("free", "2026-11-01T03:00:00.000Z", now).text).toBe(
      "Liberação vencida",
    );
    expect(accessLabel("blocked", null, now).tone).toBe("blocked");
    expect(accessLabel("blocked", "2026-12-01T03:00:00.000Z", now)).toEqual({
      text: "Bloqueio a partir de 01/12/2026",
      tone: "scheduled",
    });
  });

  it("formulário: liberar até uma data que já passou é recusado", () => {
    const base = { note: "", planCode: "" };
    expect(
      accessFormSchema.safeParse({ ...base, mode: "free", date: "2020-01-01" })
        .success,
    ).toBe(false);
    expect(
      accessFormSchema.safeParse({
        ...base,
        mode: "blocked",
        date: "2020-01-01",
      }).success,
    ).toBe(true);
    expect(
      accessFormSchema.safeParse({ ...base, mode: "free", date: "31/12/2026" })
        .success,
    ).toBe(false);
    expect(
      accessFormSchema.safeParse({ ...base, mode: "outro", date: "" }).success,
    ).toBe(false);
  });

  it("formulário: liberação vencida abre como regra normal", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    expect(accessFormDefaults("free", "2026-11-01T03:00:00.000Z", now)).toEqual(
      { mode: "normal", date: "" },
    );
    expect(accessFormDefaults("free", "2026-12-02T03:00:00.000Z", now)).toEqual(
      { mode: "free", date: "2026-12-01" },
    );
    expect(accessFormDefaults("blocked", null, now)).toEqual({
      mode: "blocked",
      date: "",
    });
    expect(accessFormDefaults(null, null, now)).toEqual({
      mode: "normal",
      date: "",
    });
  });
});
