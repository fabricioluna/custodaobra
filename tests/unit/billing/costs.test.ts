import { describe, expect, it } from "vitest";

import { estimateAiCostUsd } from "@/lib/billing/costs";

describe("estimateAiCostUsd", () => {
  it("soma tokens de entrada, de saída e o áudio", () => {
    expect(
      estimateAiCostUsd({
        ai_input_tokens: 2_000_000,
        ai_output_tokens: 1_000_000,
        audio_seconds: 3600,
      }),
    ).toBeCloseTo(0.2 + 0.5 + 0.04);
  });

  it("sem uso, custo zero", () => {
    expect(
      estimateAiCostUsd({
        ai_input_tokens: 0,
        ai_output_tokens: 0,
        audio_seconds: 0,
      }),
    ).toBe(0);
  });
});
