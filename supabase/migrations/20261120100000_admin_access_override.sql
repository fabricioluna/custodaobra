-- Acesso decidido pela equipe no painel interno, por cima da regra do plano:
--   free    = liberada (teste vencido, atraso e cancelamento não bloqueiam)
--             até access_override_at; nulo = sem prazo.
--   blocked = bloqueio suave (vê, edita, exporta e exclui; não cria nada novo)
--             a partir de access_override_at; nulo = na hora.
-- As duas colunas ficam na assinatura (o app lê junto com o plano, numa
-- consulta só); o motivo fica em admin_org_notes, que a conta não lê.

create type public.access_override as enum ('free', 'blocked');

alter table public.subscriptions
  add column access_override public.access_override,
  add column access_override_at timestamptz;

create table public.admin_org_notes (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  note text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger admin_org_notes_set_updated_at
  before update on public.admin_org_notes
  for each row execute function private.set_updated_at();

-- Só a equipe, pelas funções abaixo: sem política e sem permissão no app.
alter table public.admin_org_notes enable row level security;
revoke all on table public.admin_org_notes from anon, authenticated;

-- Muda o acesso de uma conta (e, opcionalmente, o plano). Só a equipe.
-- p_mode nulo volta à regra normal do plano.
-- A auditoria da conta registra o que mudou, sem o motivo.
create or replace function public.admin_set_access(
  p_org_id uuid,
  p_mode public.access_override default null,
  p_at timestamptz default null,
  p_note text default null,
  p_plan_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.subscriptions;
  v_new public.subscriptions;
begin
  if not private.is_platform_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  select * into v_old from public.subscriptions where org_id = p_org_id;
  if not found then
    raise exception 'conta sem assinatura' using errcode = 'P0002';
  end if;

  if p_plan_code is not null and not exists (
    select 1 from public.plans where code = p_plan_code and active
  ) then
    raise exception 'plano inválido' using errcode = '22023';
  end if;

  update public.subscriptions
     set access_override = p_mode,
         access_override_at = case when p_mode is null then null else p_at end,
         plan_code = coalesce(p_plan_code, plan_code)
   where org_id = p_org_id
  returning * into v_new;

  insert into public.admin_org_notes (org_id, note, updated_by)
  values (p_org_id, nullif(btrim(p_note), ''), (select auth.uid()))
  on conflict (org_id) do update
    set note = excluded.note, updated_by = excluded.updated_by;

  insert into public.audit_log (org_id, user_id, entity, entity_id, action, diff)
  values (
    p_org_id,
    (select auth.uid()),
    'subscription_access',
    v_new.id,
    'update',
    jsonb_build_object(
      'access_override', jsonb_build_object('from', v_old.access_override, 'to', v_new.access_override),
      'access_override_at', jsonb_build_object('from', v_old.access_override_at, 'to', v_new.access_override_at),
      'plan_code', jsonb_build_object('from', v_old.plan_code, 'to', v_new.plan_code)
    )
  );
end;
$$;

revoke all on function public.admin_set_access(uuid, public.access_override, timestamptz, text, text) from public, anon;
grant execute on function public.admin_set_access(uuid, public.access_override, timestamptz, text, text) to authenticated;

-- admin_orgs ganha o acesso e o motivo (mudar o retorno exige recriar).
drop function public.admin_orgs(date);

create function public.admin_orgs(p_month date)
returns table (
  org_id uuid,
  name text,
  kind public.org_kind,
  created_at timestamptz,
  owner_email text,
  plan_code text,
  plan_name text,
  status public.subscription_status,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  access_override public.access_override,
  access_override_at timestamptz,
  access_note text,
  projects bigint,
  members bigint,
  expenses_month bigint,
  whatsapp_entries integer,
  ai_calls integer,
  ai_input_tokens bigint,
  ai_output_tokens bigint,
  audio_seconds integer,
  template_messages integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.name,
    o.kind,
    o.created_at,
    (
      select u.email::text
        from public.organization_members m
        join auth.users u on u.id = m.user_id
       where m.org_id = o.id and m.role = 'owner'
       limit 1
    ),
    s.plan_code,
    p.name,
    s.status,
    s.trial_ends_at,
    s.current_period_end,
    s.access_override,
    s.access_override_at,
    n.note,
    (select count(*) from public.projects pr
      where pr.org_id = o.id and pr.archived_at is null),
    (select count(*) from public.organization_members m where m.org_id = o.id),
    (select count(*) from public.expenses e
      where e.org_id = o.id
        and e.status = 'confirmed'
        and e.deleted_at is null
        and e.created_at >= p_month
        and e.created_at < (p_month + interval '1 month')),
    coalesce(uc.whatsapp_entries, 0),
    coalesce(uc.ai_calls, 0),
    coalesce(uc.ai_input_tokens, 0),
    coalesce(uc.ai_output_tokens, 0),
    coalesce(uc.audio_seconds, 0),
    coalesce(uc.template_messages, 0)
  from public.organizations o
  left join public.subscriptions s on s.org_id = o.id
  left join public.plans p on p.code = s.plan_code
  left join public.admin_org_notes n on n.org_id = o.id
  left join public.usage_counters uc on uc.org_id = o.id and uc.month = p_month
  order by o.created_at desc;
end;
$$;

revoke all on function public.admin_orgs(date) from public, anon;
grant execute on function public.admin_orgs(date) to authenticated;
