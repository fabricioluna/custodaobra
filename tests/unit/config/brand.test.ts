import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BRAND_COLORS } from "@/config/brand";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function cssToken(name: string): string | undefined {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  return match?.[1]?.toLowerCase();
}

describe("cores da marca", () => {
  it.each([
    ["brand-navy", BRAND_COLORS.navy],
    ["brand-gold", BRAND_COLORS.gold],
    ["brand-white", BRAND_COLORS.white],
  ])("o token --color-%s do CSS bate com config/brand.ts", (token, value) => {
    expect(cssToken(`color-${token}`)).toBe(value);
  });

  it("segue as cores definidas no CLAUDE.md", () => {
    expect(BRAND_COLORS).toEqual({
      navy: "#132a42",
      gold: "#f5ad02",
      white: "#ffffff",
    });
  });
});
