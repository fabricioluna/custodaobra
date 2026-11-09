import type { z } from "zod";

/** Estado devolvido por uma server action de formulário. */
export type FormState<Field extends string> =
  | { status: "idle" }
  | { status: "success"; message?: string }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<Field, string>>;
    };

/** Primeiro erro de cada campo, no formato que os formulários mostram. */
export function fieldErrorsFrom<Field extends string>(
  error: z.ZodError,
): Partial<Record<Field, string>> {
  const result: Partial<Record<Field, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      result[key as Field] ??= issue.message;
    }
  }
  return result;
}

/** Valor de texto de um campo do FormData ("" se ausente ou arquivo). */
export function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}
