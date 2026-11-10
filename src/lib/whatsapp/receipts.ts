import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ReceiptItem, ReceiptMimeType } from "@/lib/ai/read-receipt";
import type { Database } from "@/types/database";

import { WHATSAPP_SOURCES } from "./conversation";

type Admin = SupabaseClient<Database>;

const BUCKET = "comprovantes";

const EXTENSIONS: Record<ReceiptMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Guarda o comprovante de um gasto lido pelo WhatsApp: o arquivo no bucket
 * privado (org_id/expense_id/arquivo) com a linha em `attachments`, e os
 * itens lidos em `expense_items`. Roda com service_role: os caminhos e linhas
 * levam o org_id de quem lançou. Devolve false se algo não foi gravado (o
 * gasto continua valendo; quem chama anota no log).
 */
export async function saveReceipt(
  admin: Admin,
  {
    orgId,
    expenseId,
    userId,
    file,
    items,
  }: {
    orgId: string;
    expenseId: string;
    userId: string;
    file: { data: ArrayBuffer; mimeType: ReceiptMimeType } | null;
    items: ReceiptItem[];
  },
): Promise<boolean> {
  const [fileSaved, itemsSaved] = await Promise.all([
    file ? saveFile(admin, { orgId, expenseId, userId, file }) : true,
    items.length ? saveItems(admin, { orgId, expenseId, items }) : true,
  ]);
  return fileSaved && itemsSaved;
}

async function saveFile(
  admin: Admin,
  {
    orgId,
    expenseId,
    userId,
    file,
  }: {
    orgId: string;
    expenseId: string;
    userId: string;
    file: { data: ArrayBuffer; mimeType: ReceiptMimeType };
  },
): Promise<boolean> {
  const path = `${orgId}/${expenseId}/${crypto.randomUUID()}.${EXTENSIONS[file.mimeType]}`;
  const upload = await admin.storage
    .from(BUCKET)
    .upload(path, file.data, { contentType: file.mimeType, upsert: false });
  if (upload.error) {
    console.error("[whatsapp] comprovante não enviado", upload.error.message);
    return false;
  }
  const { error } = await admin.from("attachments").insert({
    org_id: orgId,
    expense_id: expenseId,
    storage_path: path,
    mime_type: file.mimeType,
    size_bytes: file.data.byteLength,
    uploaded_by: userId,
  });
  if (error) {
    console.error("[whatsapp] anexo não gravado", error.message);
    await admin.storage.from(BUCKET).remove([path]);
    return false;
  }
  return true;
}

async function saveItems(
  admin: Admin,
  {
    orgId,
    expenseId,
    items,
  }: { orgId: string; expenseId: string; items: ReceiptItem[] },
): Promise<boolean> {
  const { error } = await admin.from("expense_items").insert(
    items.map((item) => ({
      org_id: orgId,
      expense_id: expenseId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_cents: item.unitPriceCents,
      total_cents: item.totalCents,
    })),
  );
  if (error) console.error("[whatsapp] itens não gravados", error.message);
  return !error;
}

/** Arquivos por rodada do cron (a API do Storage apaga em lotes). */
const PURGE_BATCH = 500;

/**
 * Cron diário: apaga os comprovantes de gastos do WhatsApp cancelados (a
 * pessoa cancelou, o pendente venceu ou ela desfez). O arquivo sai do bucket
 * pela API do Storage e depois a linha de `attachments`. Devolve quantos
 * saíram.
 */
export async function purgeCancelledReceipts(admin: Admin): Promise<number> {
  const { data, error } = await admin
    .from("attachments")
    .select("id, storage_path, expenses!inner(status, source)")
    .eq("expenses.status", "cancelled")
    .in("expenses.source", WHATSAPP_SOURCES)
    .limit(PURGE_BATCH);
  if (error) throw error;
  if (!data.length) return 0;

  const removed = await admin.storage
    .from(BUCKET)
    .remove(data.map((row) => row.storage_path));
  if (removed.error) throw removed.error;

  const { error: deleteError } = await admin
    .from("attachments")
    .delete()
    .in(
      "id",
      data.map((row) => row.id),
    );
  if (deleteError) throw deleteError;
  return data.length;
}
