import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

const PAGE_SIZE = 1000;
/** A API do Storage apaga vários arquivos por chamada; lotes moderados. */
const REMOVE_BATCH = 100;
export const RECEIPTS_BUCKET = "comprovantes";

/**
 * Falha depois que os comprovantes já saíram do Storage: o banco ficou como
 * estava, mas as fotos não voltam. A mensagem para a pessoa é outra.
 */
export class AccountDeletionAfterFilesError extends Error {
  constructor(cause: unknown) {
    super("delete_my_account falhou depois de apagar os comprovantes", {
      cause,
    });
  }
}

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

async function removePaths(supabase: Client, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const { error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .remove(paths.slice(i, i + REMOVE_BATCH));
    if (error) throw error;
  }
}

/** Nomes dentro de uma pasta do bucket (arquivos e subpastas), todas as páginas. */
async function listFolder(
  supabase: Client,
  prefix: string,
): Promise<{ name: string; isFolder: boolean }[]> {
  const entries: { name: string; isFolder: boolean }[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .list(prefix, { limit: PAGE_SIZE, offset });
    if (error) throw error;
    // Pastas vêm sem id.
    entries.push(
      ...data.map((e) => ({ name: e.name, isFolder: e.id === null })),
    );
    if (data.length < PAGE_SIZE) break;
  }
  return entries;
}

/**
 * Arquivos que sobraram em `org_id/` depois de apagar os da tabela
 * `attachments` (envio cujo registro falhou, por exemplo). Normalmente não há
 * nenhum, e a busca custa uma chamada por conta.
 */
async function leftoverPaths(
  supabase: Client,
  orgId: string,
): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await listFolder(supabase, orgId)) {
    const path = `${orgId}/${entry.name}`;
    if (!entry.isFolder) {
      paths.push(path);
      continue;
    }
    for (const file of await listFolder(supabase, path)) {
      if (!file.isFolder) paths.push(`${path}/${file.name}`);
    }
  }
  return paths;
}

/**
 * Exclui a conta de quem está logado, com a sessão dela (sem service_role):
 * 1. apaga do Storage os comprovantes das contas de que ela é dona (o Storage
 *    não aceita apagar arquivos por SQL; a política do bucket deixa o dono),
 *    os da tabela `attachments` e o que sobrar nas pastas das contas;
 * 2. `delete_my_account` apaga, numa transação, essas contas (com tudo em
 *    cascata), o log do WhatsApp dela e o login.
 * Se os arquivos não saem, para antes de mexer no banco. Se o banco falha
 * depois, lança `AccountDeletionAfterFilesError` (as fotos já se foram).
 */
export async function deleteOwnAccount(
  supabase: Client,
  userId: string,
): Promise<void> {
  const orgIds = await ownedOrgIds(supabase, userId);
  let removedFiles = false;

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
    await removePaths(supabase, paths);
    removedFiles = paths.length > 0;

    for (const orgId of orgIds) {
      const leftovers = await leftoverPaths(supabase, orgId);
      await removePaths(supabase, leftovers);
      removedFiles ||= leftovers.length > 0;
    }
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    throw removedFiles ? new AccountDeletionAfterFilesError(error) : error;
  }
}
