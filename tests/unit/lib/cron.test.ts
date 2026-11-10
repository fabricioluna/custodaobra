import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { isCronAuthorized } = await import("@/lib/cron");

describe("isCronAuthorized", () => {
  it("aceita o Bearer com o segredo certo", () => {
    expect(isCronAuthorized("Bearer segredo-123", "segredo-123")).toBe(true);
  });

  it.each([
    [null, "segredo-123"],
    ["segredo-123", "segredo-123"],
    ["Bearer errado", "segredo-123"],
    ["Bearer segredo-1234", "segredo-123"],
    ["Bearer ", ""],
    ["Bearer qualquer", undefined],
  ])("recusa %s", (header, secret) => {
    expect(isCronAuthorized(header, secret)).toBe(false);
  });
});
