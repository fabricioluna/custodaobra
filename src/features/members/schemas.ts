import { z } from "zod";

import { isUuid } from "@/lib/forms";

import { membersCopy } from "./copy";

const { errors } = membersCopy;

const cleanText = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim());

/**
 * Convite: para todas as obras (entra como administrador) ou para uma obra,
 * com o papel nela.
 */
export const inviteFormSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("all"),
    label: cleanText.pipe(
      z
        .string()
        .max(80, { error: errors.labelTooLong })
        .transform((value) => value || null),
    ),
  }),
  z.object({
    scope: z.literal("project"),
    projectId: z.string().refine(isUuid, { error: errors.projectRequired }),
    projectRole: z.enum(["editor", "viewer"], {
      error: errors.projectRoleRequired,
    }),
    label: cleanText.pipe(
      z
        .string()
        .max(80, { error: errors.labelTooLong })
        .transform((value) => value || null),
    ),
  }),
]);

export type InviteFormData = z.output<typeof inviteFormSchema>;
export type InviteFormField = "scope" | "projectId" | "projectRole" | "label";

/** Acesso de uma pessoa: papel na conta e, para membro, papel em cada obra. */
export const memberAccessSchema = z.object({
  role: z.enum(["admin", "member"]),
  projects: z.record(
    z.string().refine(isUuid),
    z.enum(["none", "editor", "viewer"]),
  ),
});

export type MemberAccess = z.output<typeof memberAccessSchema>;

export const acceptInviteSchema = z.object({
  fullName: cleanText.pipe(
    z
      .string()
      .min(1, { error: errors.fullNameRequired })
      .max(120, { error: errors.fullNameTooLong }),
  ),
});

/**
 * O que muda em project_members para chegar ao acesso escolhido. Regra pura,
 * testada: compara o que existe com o que a pessoa marcou na tela.
 */
export function diffProjectAccess(
  current: Record<string, "editor" | "viewer">,
  wanted: Record<string, "none" | "editor" | "viewer">,
) {
  const insert: { projectId: string; role: "editor" | "viewer" }[] = [];
  const update: { projectId: string; role: "editor" | "viewer" }[] = [];
  const remove: string[] = [];
  for (const [projectId, role] of Object.entries(wanted)) {
    const now = current[projectId];
    if (role === "none") {
      if (now) remove.push(projectId);
    } else if (!now) {
      insert.push({ projectId, role });
    } else if (now !== role) {
      update.push({ projectId, role });
    }
  }
  return { insert, update, remove };
}
