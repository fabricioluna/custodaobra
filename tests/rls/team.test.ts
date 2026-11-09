import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { generateInviteToken, hashInviteToken } from "@/features/members/token";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

/**
 * Equipe e convites: só dono e admin convidam e gerenciam; o link vale uma
 * vez, por 7 dias; ninguém mexe no dono; quem entra como viewer de uma obra
 * vê só ela e não edita nada.
 */
describe("equipe e convites (RLS)", () => {
  let ana: TestUser; // dona
  let bruno: TestUser; // outra organização
  let carla: TestUser; // aceita como viewer da obra 1
  let davi: TestUser; // aceita como admin
  let eva: TestUser; // tenta usar o link já usado
  let project1: string;
  let project2: string;

  /** Convite criado pela Ana; devolve o token em texto. */
  const invite = async (
    fields:
      | { project_id: string; project_role: "editor" | "viewer" }
      | { project_id?: undefined },
  ) => {
    const token = generateInviteToken();
    const { error } = await ana.client.from("invitations").insert({
      org_id: ana.orgId,
      project_id: fields.project_id ?? null,
      org_role: fields.project_id ? "member" : "admin",
      project_role: fields.project_id ? fields.project_role : null,
      token_hash: hashInviteToken(token),
      invited_by: ana.id,
    });
    if (error) throw error;
    return token;
  };

  beforeAll(async () => {
    ana = await createTestUser("team-ana");
    bruno = await createTestUser("team-bruno");
    carla = await createTestUser("team-carla");
    davi = await createTestUser("team-davi");
    eva = await createTestUser("team-eva");

    const { data: projects, error } = await ana.client
      .from("projects")
      .insert([
        { org_id: ana.orgId, name: "Obra 1", created_by: ana.id },
        { org_id: ana.orgId, name: "Obra 2", created_by: ana.id },
      ])
      .select("id, name");
    if (error) throw error;
    project1 = projects.find((p) => p.name === "Obra 1")!.id;
    project2 = projects.find((p) => p.name === "Obra 2")!.id;
  });

  afterAll(async () => {
    await deleteTestUsers([ana, bruno, carla, davi, eva]);
  });

  it("outra organização não vê nem cria convites da Ana", async () => {
    await invite({ project_id: project1, project_role: "editor" });

    const { data } = await bruno.client
      .from("invitations")
      .select("id")
      .eq("org_id", ana.orgId);
    expect(data).toEqual([]);

    const { error } = await bruno.client.from("invitations").insert({
      org_id: ana.orgId,
      org_role: "admin",
      token_hash: hashInviteToken(generateInviteToken()),
      invited_by: bruno.id,
    });
    expect(error).not.toBeNull();
  });

  it("não cria convite para dono nem com papel incoerente", async () => {
    const owner = await ana.client.from("invitations").insert({
      org_id: ana.orgId,
      org_role: "owner",
      token_hash: hashInviteToken(generateInviteToken()),
      invited_by: ana.id,
    });
    expect(owner.error).not.toBeNull();

    const memberWithoutProject = await ana.client.from("invitations").insert({
      org_id: ana.orgId,
      org_role: "member",
      token_hash: hashInviteToken(generateInviteToken()),
      invited_by: ana.id,
    });
    expect(memberWithoutProject.error).not.toBeNull();
  });

  it("visitante vê só o resumo do convite, e token errado não devolve nada", async () => {
    const token = await invite({
      project_id: project1,
      project_role: "viewer",
    });
    const { data } = await anonClient().rpc("get_invitation", {
      p_token: token,
    });
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({
      project_name: "Obra 1",
      inviter_name: "Teste",
      project_role: "viewer",
      status: "pending",
    });

    const wrong = await anonClient().rpc("get_invitation", {
      p_token: generateInviteToken(),
    });
    expect(wrong.data).toEqual([]);

    const accept = await anonClient().rpc("accept_invitation", {
      p_token: token,
    });
    expect(accept.error).not.toBeNull();
  });

  it("viewer aceito vê só a obra do convite e não edita nada", async () => {
    const token = await invite({
      project_id: project1,
      project_role: "viewer",
    });
    const { data, error } = await carla.client.rpc("accept_invitation", {
      p_token: token,
    });
    expect(error).toBeNull();
    expect(data![0].project_id).toBe(project1);

    const { data: visible } = await carla.client
      .from("projects")
      .select("id")
      .eq("org_id", ana.orgId);
    expect(visible?.map((p) => p.id)).toEqual([project1]);

    const update = await carla.client
      .from("projects")
      .update({ name: "Mudei" })
      .eq("id", project1)
      .select("id");
    expect(update.data ?? []).toEqual([]);

    // Sem obra na conta pessoal, passa a abrir o app na conta da Ana.
    const { data: profile } = await carla.client
      .from("profiles")
      .select("default_org_id")
      .eq("id", carla.id)
      .single();
    expect(profile?.default_org_id).toBe(ana.orgId);

    // Abrir o mesmo link de novo só leva para a obra.
    const again = await carla.client.rpc("accept_invitation", {
      p_token: token,
    });
    expect(again.error).toBeNull();

    // E outra pessoa não usa o link já usado.
    const other = await eva.client.rpc("accept_invitation", { p_token: token });
    expect(other.error?.message).toBe("invitation_used");
  });

  it("viewer e member não convidam nem mexem na equipe", async () => {
    const { error } = await carla.client.from("invitations").insert({
      org_id: ana.orgId,
      project_id: project1,
      org_role: "member",
      project_role: "editor",
      token_hash: hashInviteToken(generateInviteToken()),
      invited_by: carla.id,
    });
    expect(error).not.toBeNull();

    const promote = await carla.client
      .from("organization_members")
      .update({ role: "admin" })
      .eq("org_id", ana.orgId)
      .eq("user_id", carla.id)
      .select("user_id");
    expect(promote.data ?? []).toEqual([]);

    const grant = await carla.client.from("project_members").insert({
      org_id: ana.orgId,
      project_id: project2,
      user_id: carla.id,
      role: "editor",
    });
    expect(grant.error).not.toBeNull();

    const team = await carla.client.rpc("org_team", { p_org_id: ana.orgId });
    expect(team.data).toEqual([]);
  });

  it("convite vencido ou cancelado não funciona", async () => {
    const expired = await invite({
      project_id: project2,
      project_role: "viewer",
    });
    await adminClient()
      .from("invitations")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("token_hash", hashInviteToken(expired));
    const r1 = await eva.client.rpc("accept_invitation", { p_token: expired });
    expect(r1.error?.message).toBe("invitation_expired");

    const revoked = await invite({
      project_id: project2,
      project_role: "viewer",
    });
    const { data: cancelled } = await ana.client
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashInviteToken(revoked))
      .select("id");
    expect(cancelled).toHaveLength(1);
    const r2 = await eva.client.rpc("accept_invitation", { p_token: revoked });
    expect(r2.error?.message).toBe("invitation_revoked");

    // Convite cancelado não volta a valer.
    const reopen = await ana.client
      .from("invitations")
      .update({ revoked_at: null })
      .eq("token_hash", hashInviteToken(revoked))
      .select("id");
    expect(reopen.data ?? []).toEqual([]);
  });

  it("admin aceito vê todas as obras e a equipe, mas não mexe na dona", async () => {
    const token = await invite({});
    const { error } = await davi.client.rpc("accept_invitation", {
      p_token: token,
    });
    expect(error).toBeNull();

    const { data: visible } = await davi.client
      .from("projects")
      .select("id")
      .eq("org_id", ana.orgId);
    expect(visible).toHaveLength(2);

    const { data: team } = await davi.client.rpc("org_team", {
      p_org_id: ana.orgId,
    });
    expect(team?.map((m) => m.role)).toEqual(["owner", "admin", "member"]);
    const carlaRow = team!.find((m) => m.user_id === carla.id)!;
    expect(carlaRow.email).toBe(carla.email);
    expect(carlaRow.projects).toEqual([
      { id: project1, name: "Obra 1", role: "viewer" },
    ]);

    const demoteOwner = await davi.client
      .from("organization_members")
      .update({ role: "member" })
      .eq("org_id", ana.orgId)
      .eq("user_id", ana.id)
      .select("user_id");
    expect(demoteOwner.data ?? []).toEqual([]);

    const removeOwner = await davi.client
      .from("organization_members")
      .delete()
      .eq("org_id", ana.orgId)
      .eq("user_id", ana.id)
      .select("user_id");
    expect(removeOwner.data ?? []).toEqual([]);

    const makeOwner = await davi.client
      .from("organization_members")
      .update({ role: "owner" })
      .eq("org_id", ana.orgId)
      .eq("user_id", carla.id)
      .select("user_id");
    expect(makeOwner.error ?? makeOwner.data?.length === 0).toBeTruthy();
  });

  it("admin muda o papel na obra, dá acesso a outra e tira a pessoa da conta", async () => {
    const toEditor = await davi.client
      .from("project_members")
      .update({ role: "editor" })
      .eq("project_id", project1)
      .eq("user_id", carla.id)
      .select("role");
    expect(toEditor.data).toEqual([{ role: "editor" }]);

    const grant = await davi.client.from("project_members").insert({
      org_id: ana.orgId,
      project_id: project2,
      user_id: carla.id,
      role: "viewer",
    });
    expect(grant.error).toBeNull();

    const remove = await ana.client
      .from("organization_members")
      .delete()
      .eq("org_id", ana.orgId)
      .eq("user_id", carla.id)
      .select("user_id");
    expect(remove.data).toHaveLength(1);

    const { data: visible } = await carla.client
      .from("projects")
      .select("id")
      .eq("org_id", ana.orgId);
    expect(visible).toEqual([]);
  });

  it("cada um pode sair da conta, menos a dona", async () => {
    const leave = await davi.client
      .from("organization_members")
      .delete()
      .eq("org_id", ana.orgId)
      .eq("user_id", davi.id)
      .select("user_id");
    expect(leave.data).toHaveLength(1);

    const ownerLeave = await ana.client
      .from("organization_members")
      .delete()
      .eq("org_id", ana.orgId)
      .eq("user_id", ana.id)
      .select("user_id");
    expect(ownerLeave.data ?? []).toEqual([]);
  });

  it("mudanças na equipe ficam na auditoria", async () => {
    const { data } = await ana.client
      .from("audit_log")
      .select("entity, action")
      .eq("org_id", ana.orgId)
      .in("entity", ["invitations", "organization_members", "project_members"]);
    const kinds = new Set(data?.map((r) => `${r.entity}:${r.action}`));
    expect(kinds.has("invitations:create")).toBe(true);
    expect(kinds.has("organization_members:create")).toBe(true);
    expect(kinds.has("organization_members:delete")).toBe(true);
    expect(kinds.has("project_members:update")).toBe(true);
  });
});
