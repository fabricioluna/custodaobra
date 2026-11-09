import { z } from "zod";

import { organizationsCopy } from "./copy";

const { errors } = organizationsCopy;

/** Junta espaços repetidos e tira os das pontas. */
const cleanText = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim());

export const onboardingSchema = z.object({
  fullName: cleanText.pipe(
    z
      .string()
      .min(1, { error: errors.fullNameRequired })
      .max(120, { error: errors.fullNameTooLong }),
  ),
  accountName: cleanText.pipe(
    z
      .string()
      .min(1, { error: errors.accountNameRequired })
      .max(80, { error: errors.accountNameTooLong }),
  ),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
