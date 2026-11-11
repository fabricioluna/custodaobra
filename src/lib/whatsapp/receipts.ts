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
 * levam o org_id de quem lançou. Devolve `ok = false` se algo não foi
 * gravado (o gasto continua valendo; quem chama anota no log) e os ids dos
 * itens, na ordem do cupom.
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
): Promise<{ ok: boolean; itemIds: string[] }> {
  const [fileSaved, itemIds] = await Promise.all([
    file ? saveFile(admin, { orgId, expenseId, userId, file }) : true,
    items.length ? saveItems(admin, { orgId, expenseId, items }) : [],
  ]);
  return {
    ok: fileSaved && itemIds !== null,
    itemIds: itemIds ?? [],
  };
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
): Promise<string[] | null> {
  // Os ids nascem aqui, na ordem do cupom: a divisão por etapa liga cada item
  // à sua etapa sem depender da ordem em que o banco devolve as linhas.
  const ids = items.map(() => crypto.randomUUID());
  const { error } = await admin.from("expense_items").insert(
    items.map((item, index) => ({
      id: ids[index],
      org_id: orgId,
      expense_id: expenseId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_cents: item.unitPriceCents,
      total_cents: item.totalCents,
    })),
  );
  if (error) {
    console.error("[whatsapp] itens não gravados", error.message);
    return null;
  }
  return ids;
}

/**
 * Copia os comprovantes de um gasto para outro da mesma conta (divisão da
 * nota por etapa): cada gasto fica com o seu arquivo, porque o caminho no
 * bucket é único e apagar um gasto apaga o arquivo dele. Devolve false se
 * algum não foi copiado.
 */
export async function copyReceipts(
  admin: Admin,
  {
    orgId,
    fromExpenseId,
    toExpenseIds,
    userId,
  }: {
    orgId: string;
    fromExpenseId: string;
    toExpenseIds: string[];
    userId: string;
  },
): Promise<boolean> {
  const { data, error } = await admin
    .from("attachments")
    .select("storage_path, mime_type, size_bytes")
    .eq("org_id", orgId)
    .eq("expense_id", fromExpenseId);
  if (error) {
    console.error("[whatsapp] comprovantes não lidos", error.message);
    return false;
  }
  const copies = toExpenseIds.flatMap((expenseId) =>
    data.map(async (file) => {
      const extension = file.storage_path.split(".").pop() ?? "jpg";
      const path = `${orgId}/${expenseId}/${crypto.randomUUID()}.${extension}`;
      const copied = await admin.storage
        .from(BUCKET)
        .copy(file.storage_path, path);
      if (copied.error) {
        console.error(
          "[whatsapp] comprovante não copiado",
          copied.error.message,
        );
        return false;
      }
      const { error: insertError } = await admin.from("attachments").insert({
        org_id: orgId,
        expense_id: expenseId,
        storage_path: path,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        uploaded_by: userId,
      });
      if (insertError) {
        console.error(
          "[whatsapp] anexo copiado não gravado",
          insertError.message,
        );
        await admin.storage.from(BUCKET).remove([path]);
        return false;
      }
      return true;
    }),
  );
  return (await Promise.all(copies)).every(Boolean);
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
