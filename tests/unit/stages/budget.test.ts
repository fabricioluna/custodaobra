import { describe, expect, it } from "vitest";

import {
  distributeEstimate,
  estimateTotalCents,
  stageStatus,
  worstLevel,
} from "@/features/stages/budget";

const plan = (
  budgetCents: number | null,
  spentCents: number,
  committedCents = 0,
  progressPercent = 0,
) => ({ budgetCents, spentCents, committedCents, progressPercent });

describe("stageStatus", () => {
  it("sem previsto não tem alerta", () => {
    expect(stageStatus(plan(null, 50_000))).toEqual({
      level: "none",
      usedPercent: null,
      spentPercent: null,
      aheadOfProgress: false,
    });
  });

  it("verde até 80% do previsto", () => {
    expect(stageStatus(plan(100_000, 80_000, 0, 80)).level).toBe("ok");
  });

  it("amarelo quando realizado + comprometido passa de 80%", () => {
    const status = stageStatus(plan(100_000, 50_000, 30_001, 90));
    expect(status.level).toBe("warn");
    expect(status.usedPercent).toBe(80);
  });

  it("vermelho acima de 100%", () => {
    expect(stageStatus(plan(100_000, 90_000, 10_001, 100)).level).toBe("over");
    expect(stageStatus(plan(100_000, 100_000, 0, 100)).level).toBe("warn");
  });

  it("previsto zero com gasto estoura", () => {
    expect(stageStatus(plan(0, 1)).level).toBe("over");
    expect(stageStatus(plan(0, 0)).level).toBe("ok");
  });

  it("avisa quando o gasto passa o progresso em mais de 20 pontos", () => {
    expect(stageStatus(plan(100_000, 50_000, 0, 29)).aheadOfProgress).toBe(
      true,
    );
    expect(stageStatus(plan(100_000, 50_000, 0, 30)).aheadOfProgress).toBe(
      false,
    );
    // Comprometido não conta para o progresso: só o que já foi gasto.
    expect(stageStatus(plan(100_000, 0, 90_000, 0)).aheadOfProgress).toBe(
      false,
    );
  });
});

describe("worstLevel", () => {
  it("pega o pior nível", () => {
    expect(worstLevel([])).toBe("none");
    expect(worstLevel(["ok", "none", "warn", "ok"])).toBe("warn");
    expect(worstLevel(["warn", "over"])).toBe("over");
  });
});

describe("estimateTotalCents", () => {
  it("multiplica área por custo por m²", () => {
    expect(estimateTotalCents(120, 250_000)).toBe(30_000_000);
    expect(estimateTotalCents(85.5, 199_999)).toBe(17_099_915);
  });
});

describe("distributeEstimate", () => {
  it("divide pelo percentual e a soma bate com o total", () => {
    const stages = [
      { id: "a", defaultPercent: 3 },
      { id: "b", defaultPercent: 14 },
      { id: "c", defaultPercent: 83 },
    ];
    const result = distributeEstimate(30_000_000, stages);
    expect(result.get("a")).toBe(900_000);
    expect(result.get("b")).toBe(4_200_000);
    expect(result.get("c")).toBe(24_900_000);
  });

  it("reescala quando etapas foram removidas e arredonda em reais", () => {
    const stages = [
      { id: "a", defaultPercent: 1 },
      { id: "b", defaultPercent: 1 },
      { id: "c", defaultPercent: 1 },
      { id: "nova", defaultPercent: null },
    ];
    const result = distributeEstimate(10_000, stages);
    const values = ["a", "b", "c"].map((id) => result.get(id)!);
    expect(values.every((v) => v % 100 === 0)).toBe(true);
    expect(values.reduce((s, v) => s + v, 0)).toBe(10_000);
    expect(result.get("nova")).toBeNull();
  });

  it("sem percentuais ou sem total, não sugere nada", () => {
    expect(
      distributeEstimate(10_000, [{ id: "a", defaultPercent: null }]).get("a"),
    ).toBeNull();
    expect(
      distributeEstimate(0, [{ id: "a", defaultPercent: 5 }]).get("a"),
    ).toBeNull();
  });
});
