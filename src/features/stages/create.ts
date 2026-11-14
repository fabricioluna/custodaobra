import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/** Nome de etapa como a pessoa digitou, sem espaços sobrando (até 80 letras). */
export function cleanStageName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name || name.length > 80) return null;
  return name;
}

export type CreatedStage = { id: string; name: string; created: boolean };

/**
 * Etapa pelo nome na obra: usa a que já existe (sem diferenciar maiúsculas)
 * ou cria uma no fim da lista. Usado em Etapas, no lançamento pelo app e no
 * WhatsApp. Com a sessão da pessoa, o RLS só deixa quem edita a obra; com o
 * service_role (bot), quem chama confere antes que a pessoa pode lançar.
 */
export async function findOrCreateStage(
  supabase: SupabaseClient<Database>,
  orgId: string,
  projectId: string,
  name: string,
): Promise<CreatedStage | null> {
  const { data: stages, error } = await supabase
    .from("stages")
    .select("id, name, sort_order")
    .eq("org_id", orgId)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false });
  if (error) return null;

  const wanted = name.toLocaleLowerCase("pt-BR");
  const existing = stages.find(
    (stage) => stage.name.toLocaleLowerCase("pt-BR") === wanted,
  );
  if (existing) return { id: existing.id, name: existing.name, created: false };

  const { data, error: insertError } = await supabase
    .from("stages")
    .insert({
      org_id: orgId,
      project_id: projectId,
      name,
      sort_order: (stages[0]?.sort_order ?? 0) + 1,
    })
    .select("id, name")
    .single();
  if (insertError || !data) return null;
  return { id: data.id, name: data.name, created: true };
}
