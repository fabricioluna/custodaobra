import { describe, expect, it } from "vitest";

import {
  diffProjectAccess,
  inviteFormSchema,
} from "@/features/members/schemas";
import {
  generateInviteToken,
  hashInviteToken,
  isInviteTokenShape,
} from "@/features/members/token";

describe("token do convite", () => {
  it("gera tokens únicos de 43 caracteres em base64url", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toBe(b);
    expect(isInviteTokenShape(a)).toBe(true);
  });

  it("guarda só o SHA-256 em hex, igual ao do Postgres", () => {
    // sha256('abc') conhecido.
    expect(hashInviteToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("recusa o que não tem cara de token", () => {
    expect(isInviteTokenShape("")).toBe(false);
    expect(isInviteTokenShape("abc")).toBe(false);
    expect(isInviteTokenShape(`${"a".repeat(42)}!`)).toBe(false);
  });
});

describe("inviteFormSchema", () => {
  it("convite para uma obra exige obra e papel", () => {
    const result = inviteFormSchema.safeParse({
      scope: "project",
      projectId: "",
      label: "",
    });
    expect(result.success).toBe(false);
  });

  it("apelido vazio vira null e espaços somem", () => {
    const result = inviteFormSchema.parse({
      scope: "project",
      projectId: "7b0c5a2e-1d3f-4e5a-9b6c-8d7e6f5a4b3c",
      projectRole: "viewer",
      label: "  Seu   Zé ",
    });
    expect(result).toMatchObject({ projectRole: "viewer", label: "Seu Zé" });
    expect(inviteFormSchema.parse({ scope: "all", label: "" })).toEqual({
      scope: "all",
      label: null,
    });
  });
});

describe("diffProjectAccess", () => {
  it("separa o que entra, muda e sai", () => {
    expect(
      diffProjectAccess(
        { a: "viewer", b: "editor", c: "viewer" },
        { a: "editor", b: "editor", c: "none", d: "viewer", e: "none" },
      ),
    ).toEqual({
      insert: [{ projectId: "d", role: "viewer" }],
      update: [{ projectId: "a", role: "editor" }],
      remove: ["c"],
    });
  });
});
