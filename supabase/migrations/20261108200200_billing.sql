-- Comercial: planos e assinaturas, com RLS.

-- Planos (global) ----------------------------------------------------------

create table public.plans (
  code text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  max_projects integer not null check (max_projects > 0),
  max_members integer not null check (max_members > 0),
  whatsapp_enabled boolean not null default true,
  max_whatsapp_entries_month integer not null check (max_whatsapp_entries_month >= 0),
  max_ai_calls_month integer not null check (max_ai_calls_month >= 0),
  price_cents_month bigint not null default 0 check (price_cents_month >= 0),
  -- Dias de teste grátis de uma conta nova neste plano.
  trial_days integer not null default 14 check (trial_days >= 0),
  -- Plano em que toda conta nova começa. Só um pode ser o padrão.
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index plans_single_default_idx on public.plans (is_default) where is_default;

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function private.set_updated_at();

alter table public.plans enable row level security;

revoke insert, update, delete on table public.plans from anon, authenticated;

-- Planos não são segredo: a página de preços também vai lê-los.
create policy "Todos veem os planos"
  on public.plans for select
  to anon, authenticated
  using (true);

-- Planos provisórios: preços e limites ainda não decididos (ver CLAUDE.md, seção 15).
insert into public.plans (
  code, name, max_projects, max_members, whatsapp_enabled,
  max_whatsapp_entries_month, max_ai_calls_month, price_cents_month,
  trial_days, is_default
) values
  ('pessoal', 'Pessoal', 1, 3, true, 300, 600, 0, 14, true),
  ('profissional', 'Profissional', 10, 10, true, 3000, 6000, 0, 14, false);

-- Assinaturas (uma por organização) ----------------------------------------

create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations (id) on delete cascade,
  plan_code text not null references public.plans (code),
  status public.subscription_status not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function private.set_updated_at();

alter table public.subscriptions enable row level security;

revoke all on table public.subscriptions from anon;
-- Assinatura só muda pelo servidor (cadastro e, na Fase 5, cobrança).
revoke insert, update, delete on table public.subscriptions from authenticated;

create policy "Membros veem a assinatura da organização"
  on public.subscriptions for select
  to authenticated
  using (private.is_org_member(org_id));
