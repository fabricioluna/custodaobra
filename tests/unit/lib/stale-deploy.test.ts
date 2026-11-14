// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { isStaleDeploymentError, reloadOnce } from "@/lib/stale-deploy";

describe("isStaleDeploymentError", () => {
  it("reconhece a página de antes de um deploy", () => {
    expect(
      isStaleDeploymentError(
        new Error("An unexpected response was received from the server."),
      ),
    ).toBe(true);
    expect(
      isStaleDeploymentError(
        new Error('Server Action "7f3a" was not found on the server.'),
      ),
    ).toBe(true);
    const chunk = new Error("Loading chunk 123 failed.");
    chunk.name = "ChunkLoadError";
    expect(isStaleDeploymentError(chunk)).toBe(true);
  });

  it("não confunde com outros erros", () => {
    expect(isStaleDeploymentError(new Error("Cannot read properties"))).toBe(
      false,
    );
    expect(isStaleDeploymentError("texto")).toBe(false);
    expect(isStaleDeploymentError(null)).toBe(false);
  });
});

describe("reloadOnce", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("recarrega uma vez e não de novo no mesmo minuto", () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      reload,
    });
    expect(reloadOnce(1_000_000)).toBe(true);
    expect(reloadOnce(1_030_000)).toBe(false);
    expect(reloadOnce(1_070_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
