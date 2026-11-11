import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

const PAGE_SIZE = 1000;
/** A API do Storage apaga vários arquivos por chamada; lotes moderados. */
const REMOVE_BATCH = 100;
export const RECEIPTS_BUCKET = "comprovantes";

/** Contas de que a pessoa é dona (cada conta tem um único dono). */
export async function ownedOrgIds(
  supabase: Client,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("role", "owner");
  if (error) throw error;
  return data.map((row) => row.org_id);
}

/**
 * Exclui a conta de quem está logado, com a sessão dela (sem service_role):
 * 1. apaga do Storage os comprovantes das contas de que ela é dona (o Storage
 *    não aceita apagar arquivos por SQL; a política do bucket deixa o dono);
 * 2. `delete_my_account` apaga, numa transação, essas contas (com tudo em
 *    cascata), o log do WhatsApp dela e o login.
 * Se os arquivos não saem, para antes de mexer no banco.
 */
export async function deleteOwnAccount(
  supabase: Client,
  userId: string,
): Promise<void> {
  const orgIds = await ownedOrgIds(supabase, userId);

  if (orgIds.length) {
    const paths: string[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("attachments")
        .select("storage_path")
        .in("org_id", orgIds)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      paths.push(...data.map((row) => row.storage_path));
      if (data.length < PAGE_SIZE) break;
    }
    for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
      const { error } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .remove(paths.slice(i, i + REMOVE_BATCH));
      if (error) throw error;
    }
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
}
