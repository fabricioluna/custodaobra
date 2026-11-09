-- Identidade e contas: organizações, perfis e membros, com RLS.

create type public.org_kind as enum ('personal', 'business');
create type public.org_role as enum ('owner', 'admin', 'member');

-- Organizações (a conta que paga) ------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null unique
    check (char_length(slug) between 3 and 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind public.org_kind not null default 'personal',
  timezone text not null default 'America/Recife',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

-- Perfis (1 para 1 com auth.users) -----------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  -- Número como veio da Meta (wa_id), com ou sem "+". Vinculado na Fase 3.
  whatsapp_phone text unique
    check (whatsapp_phone is null or whatsapp_phone ~ '^\+?[1-9][0-9]{7,14}$'),
  whatsapp_linked_at timestamptz,
  default_org_id uuid references public.organizations (id) on delete set null,
  -- Preenchido quando a pessoa conclui o primeiro acesso (nome da conta).
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Membros da organização ---------------------------------------------------

create table public.organization_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index organization_members_user_id_idx on public.organization_members (user_id);

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function private.set_updated_at();

-- Funções usadas nas políticas ---------------------------------------------
-- SECURITY DEFINER para ler organization_members sem cair na própria RLS
-- (evita recursão). Só respondem sobre o usuário logado (auth.uid()).

create or replace function private.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_org_role(p_org_id uuid, p_roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

revoke all on function private.is_org_member(uuid) from public;
revoke all on function private.has_org_role(uuid, public.org_role[]) from public;
grant execute on function private.is_org_member(uuid) to authenticated, service_role;
grant execute on function private.has_org_role(uuid, public.org_role[]) to authenticated, service_role;

-- RLS: organizations -------------------------------------------------------
-- Criação só pelo gatilho de cadastro (e, no futuro, por funções do servidor).

alter table public.organizations enable row level security;

revoke all on table public.organizations from anon;
revoke insert, update, delete on table public.organizations from authenticated;
-- Só nome e fuso podem ser alterados pelo app; slug e tipo, não.
grant update (name, timezone) on table public.organizations to authenticated;

create policy "Membros veem a organização"
  on public.organizations for select
  to authenticated
  using (private.is_org_member(id));

create policy "Dono e admin editam a organização"
  on public.organizations for update
  to authenticated
  using (private.has_org_role(id, array['owner', 'admin']::public.org_role[]))
  with check (private.has_org_role(id, array['owner', 'admin']::public.org_role[]));

-- RLS: profiles ------------------------------------------------------------

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke insert, update, delete on table public.profiles from authenticated;
-- WhatsApp é vinculado só pelo servidor (Fase 3).
grant update (full_name, default_org_id, onboarded_at) on table public.profiles to authenticated;

create policy "Cada um vê o próprio perfil"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Cada um edita o próprio perfil"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (default_org_id is null or private.is_org_member(default_org_id))
  );

-- RLS: organization_members ------------------------------------------------
-- Leitura para quem é da organização. Escrita só pelo servidor até os
-- convites (Fase 2).

alter table public.organization_members enable row level security;

revoke all on table public.organization_members from anon;
revoke insert, update, delete on table public.organization_members from authenticated;

create policy "Membros veem os membros da organização"
  on public.organization_members for select
  to authenticated
  using (private.is_org_member(org_id));
