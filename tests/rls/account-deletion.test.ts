import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { deleteOwnAccount, RECEIPTS_BUCKET } from "@/features/account/delete";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

vi.mock("server-only", () => ({}));
const { buildAccountExport } = await import("@/features/account/export");

/**
 * Exclusão da própria conta (LGPD): some a conta de que a pessoa é dona, com
 * obras, gastos e comprovantes; nas contas dos outros ela só sai, e os gastos
 * que lançou ficam sem autor; o log do WhatsApp dela some; ninguém mais é
 * afetado; sem login, a função não roda.
 */
describe("excluir a própria conta", () => {
  const admin = adminClient();
  let ana: TestUser; // dona da conta com obra e comprovante
  let bruno: TestUser; // dono da própria conta e editor numa obra da Ana
  let carla: TestUser; // outra conta, não pode ser afetada
  let anaProject: string;
  let carlaProject: string;
  let brunoExpenseInAna: string;
  const receiptPath = () => `${ana.orgId}/${anaExpense}/cupom.jpg`;
  let anaExpense: string;
  const anaPhone = `55819${Math.floor(60000000 + Math.random() * 39999999)}`;
  const carlaPhone = `55819${Math.floor(60000000 + Math.random() * 39999999)}`;

  const materialId = async () => {
    const { data, error } = await admin
      .from("categories")
      .select("id")
      .is("org_id", null)
      .eq("code", "material")
      .single();
    if (error) throw error;
    return data.id;
  };

  const project = async (user: TestUser, name: string) => {
    const { data, error } = await user.client
      .from("projects")
      .insert({ org_id: user.orgId, name, created_by: user.id })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  };

  const expense = async (
    user: TestUser,
    orgId: string,
    projectId: string,
    category: string,
  ) => {
    const { data, error } = await user.client
      .from("expenses")
      .insert({
        org_id: orgId,
        project_id: projectId,
        category_id: category,
        description: "Cimento",
        amount_cents: 7800,
        spent_on: "2026-11-10",
        status: "confirmed",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  };

  const message = (phone: string, userId: string | null) => ({
    wa_message_id: `wamid.test.${crypto.randomUUID()}`,
    direction: "in" as const,
    from_phone: phone,
    user_id: userId,
    type: "text",
    payload: { text: "300 pedreiro" },
  });

  beforeAll(async () => {
    ana = await createTestUser("del-ana");
    bruno = await createTestUser("del-bruno");
    carla = await createTestUser("del-carla");
    const material = await materialId();

    anaProject = await project(ana, "Casa da Ana");
    carlaProject = await project(carla, "Casa da Carla");
    await project(bruno, "Casa do Bruno");

    // Bruno entra como membro editor da obra da Ana.
    const membership = await admin
      .from("organization_members")
      .insert({ org_id: ana.orgId, user_id: bruno.id, role: "member" });
    if (membership.error) throw membership.error;
    const projectMember = await admin.from("project_members").insert({
      project_id: anaProject,
      user_id: bruno.id,
      org_id: ana.orgId,
      role: "editor",
    });
    if (projectMember.error) throw projectMember.error;

    anaExpense = await expense(ana, ana.orgId, anaProject, material);
    brunoExpenseInAna = await expense(bruno, ana.orgId, anaProject, material);
    await expense(carla, carla.orgId, carlaProject, material);

    const upload = await ana.client.storage.from(RECEIPTS_BUCKET).upload(
      receiptPath(),
      new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
        type: "image/jpeg",
      }),
      { contentType: "image/jpeg" },
    );
    if (upload.error) throw upload.error;
    const attachment = await ana.client.from("attachments").insert({
      org_id: ana.orgId,
      expense_id: anaExpense,
      storage_path: receiptPath(),
      mime_type: "image/jpeg",
      size_bytes: 4,
      uploaded_by: ana.id,
    });
    if (attachment.error) throw attachment.error;

    await admin
      .from("profiles")
      .update({ whatsapp_phone: anaPhone })
      .eq("id", ana.id);
    const messages = await admin.from("whatsapp_messages").insert([
      message(anaPhone, ana.id),
      // Antes de vincular, a mensagem chega sem usuário.
      message(anaPhone, null),
      message(carlaPhone, carla.id),
    ]);
    if (messages.error) throw messages.error;
  });

  afterAll(async () => {
    await deleteTestUsers([ana, bruno, carla]);
    await admin.from("whatsapp_messages").delete().eq("from_phone", carlaPhone);
  });

  it("a planilha traz o que a pessoa vê e nada das outras contas", async () => {
    const buffer = await buildAccountExport(bruno.client, {
      id: bruno.id,
      email: bruno.email,
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const column = (sheet: string, index: number) =>
      (workbook.getWorksheet(sheet)?.getColumn(index).values ?? []).slice(2);

    expect(column("Meus dados", 2)).toEqual([bruno.email]);
    // Obra própria e a obra da Ana em que é editor; a da Carla não.
    expect(column("Obras", 2).sort()).toEqual(["Casa da Ana", "Casa do Bruno"]);
    expect(column("Gastos", 1).sort()).toEqual(["Casa da Ana", "Casa da Ana"]);
    expect(column("Comprovantes", 4)).toEqual(["cupom.jpg"]);
  });

  it("sem login, a função não roda", async () => {
    const { error } = await anonClient().rpc("delete_my_account");
    expect(error).not.toBeNull();
  });

  it("quem é convidado sai da conta dos outros sem apagar nada dela", async () => {
    await deleteOwnAccount(bruno.client, bruno.id);

    const user = await admin.auth.admin.getUserById(bruno.id);
    expect(user.data.user).toBeNull();
    const brunoOrg = await admin
      .from("organizations")
      .select("id")
      .eq("id", bruno.orgId);
    expect(brunoOrg.data).toEqual([]);

    // A conta da Ana continua, e o gasto do Bruno nela fica sem autor.
    const anaOrg = await admin
      .from("organizations")
      .select("id")
      .eq("id", ana.orgId);
    expect(anaOrg.data).toHaveLength(1);
    const kept = await admin
      .from("expenses")
      .select("created_by")
      .eq("id", brunoExpenseInAna)
      .single();
    expect(kept.data?.created_by).toBeNull();
    const members = await admin
      .from("organization_members")
      .select("user_id")
      .eq("org_id", ana.orgId);
    expect(members.data?.map((m) => m.user_id)).toEqual([ana.id]);
  });

  it("a dona apaga a conta inteira, os comprovantes e o log do WhatsApp", async () => {
    await deleteOwnAccount(ana.client, ana.id);

    const user = await admin.auth.admin.getUserById(ana.id);
    expect(user.data.user).toBeNull();
    const org = await admin
      .from("organizations")
      .select("id")
      .eq("id", ana.orgId);
    expect(org.data).toEqual([]);
    const subscription = await admin
      .from("subscriptions")
      .select("id")
      .eq("org_id", ana.orgId);
    expect(subscription.data).toEqual([]);
    const expenses = await admin
      .from("expenses")
      .select("id")
      .eq("org_id", ana.orgId);
    expect(expenses.data).toEqual([]);
    const files = await admin.storage
      .from(RECEIPTS_BUCKET)
      .list(`${ana.orgId}/${anaExpense}`);
    expect(files.data).toEqual([]);
    const log = await admin
      .from("whatsapp_messages")
      .select("id")
      .eq("from_phone", anaPhone);
    expect(log.data).toEqual([]);
  });

  it("ninguém mais é afetado", async () => {
    const org = await admin
      .from("organizations")
      .select("id")
      .eq("id", carla.orgId);
    expect(org.data).toHaveLength(1);
    const expenses = await carla.client
      .from("expenses")
      .select("id")
      .eq("project_id", carlaProject);
    expect(expenses.data).toHaveLength(1);
    const log = await admin
      .from("whatsapp_messages")
      .select("id")
      .eq("from_phone", carlaPhone);
    expect(log.data).toHaveLength(1);
  });
});
