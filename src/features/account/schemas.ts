import { z } from "zod";

import { accountCopy } from "./copy";

export const deleteAccountSchema = z.object({
  confirm: z.literal(accountCopy.deleteSection.confirmWord, {
    error: accountCopy.errors.confirm,
  }),
});
