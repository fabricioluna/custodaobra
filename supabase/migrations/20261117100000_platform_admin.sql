-- Painel interno da equipe do app: todas as contas, assinaturas e uso.
--
-- Quem é da equipe fica em platform_admins, que o app não lê nem escreve (sem
-- política RLS e sem permissão para anon/authenticated): a inclusão é feita
-- por SQL, pela equipe, em cada ambiente. As consultas do painel são funções
-- security definer que conferem a pessoa logada; sem service_role.

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger platform_admins_set_updated_at
  before update on public.platform_admins
  for each row execute function private.set_updated_at();

alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from anon, authenticated;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_platform_admin() from public, anon;

-- Uma linha por conta, com o uso do mês pedido (primeiro dia do mês).
create or replace function public.admin_orgs(p_month date)
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
  left join public.usage_counters uc on uc.org_id = o.id and uc.month = p_month
  order by o.created_at desc;
end;
$$;

revoke all on function public.admin_orgs(date) from public, anon;
grant execute on function public.admin_orgs(date) to authenticated;
