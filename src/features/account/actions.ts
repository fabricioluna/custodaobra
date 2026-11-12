"use server";

import { redirect } from "next/navigation";

import { ACCOUNT_DELETED_PATH } from "@/lib/auth/paths";
import { requireUserId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { accountCopy } from "./copy";
import { AccountDeletionAfterFilesError, deleteOwnAccount } from "./delete";
import { deleteAccountSchema } from "./schemas";

export type DeleteAccountState = { error: string | null };

/** Exclui a conta de quem está logado (LGPD). Pede "EXCLUIR" digitado. */
export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const parsed = deleteAccountSchema.safeParse({
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: accountCopy.errors.confirm };

  const userId = await requireUserId();
  const supabase = await createClient();
  try {
    await deleteOwnAccount(supabase, userId);
  } catch (error) {
    console.error("[conta] falha ao excluir", error);
    return {
      error:
        error instanceof AccountDeletionAfterFilesError
          ? accountCopy.errors.failedAfterFiles
          : accountCopy.errors.failed,
    };
  }
  // O login já não existe: só limpa os cookies da sessão.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  redirect(ACCOUNT_DELETED_PATH);
}
