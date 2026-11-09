-- Orçamento e progresso por etapa (Fase 2) ------------------------------------
-- O orçamento vale por etapa; o total da obra é a soma das etapas. Por isso o
-- total gravado na obra sai, e entra o custo por m² usado na última estimativa
-- (só para preencher o formulário de novo; o app nunca busca esse valor).

alter table public.projects drop column budget_total_cents;

alter table public.projects
  add column cost_per_m2_cents bigint
    check (cost_per_m2_cents is null or cost_per_m2_cents > 0);

grant update (cost_per_m2_cents) on table public.projects to authenticated;

-- Grava orçamento e/ou progresso de várias etapas da obra de uma vez.
-- p_items: [{ "stage_id": uuid, "budget_cents"?: bigint | null,
--             "progress_percent"?: integer }]
-- Chave ausente = não muda; "budget_cents": null = limpa o orçamento.
-- security invoker: o RLS de stages decide quem pode (quem edita a obra).
create or replace function public.update_stage_plan(p_project_id uuid, p_items jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items precisa ser uma lista' using errcode = '22023';
  end if;

  update public.stages s
  set
    budget_cents = case
      when x.item ? 'budget_cents' then (x.item ->> 'budget_cents')::bigint
      else s.budget_cents
    end,
    progress_percent = case
      when x.item ? 'progress_percent' then (x.item ->> 'progress_percent')::integer
      else s.progress_percent
    end
  from jsonb_array_elements(p_items) as x(item)
  where s.project_id = p_project_id
    and s.id = (x.item ->> 'stage_id')::uuid;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.update_stage_plan(uuid, jsonb) from public, anon;
grant execute on function public.update_stage_plan(uuid, jsonb) to authenticated;
