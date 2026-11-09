-- Obras, membros por obra e etapas (com modelos padrão), com RLS.

create type public.project_standard as enum ('economico', 'normal', 'alto');
create type public.project_status as enum ('planejamento', 'em_andamento', 'pausada', 'concluida');
create type public.project_role as enum ('editor', 'viewer');

-- Obras ---------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  address text check (address is null or char_length(address) <= 200),
  city text check (city is null or char_length(city) <= 80),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  built_area_m2 numeric(10, 2) check (built_area_m2 is null or built_area_m2 > 0),
  standard public.project_standard,
  start_date date,
  expected_end_date date,
  status public.project_status not null default 'em_andamento',
  budget_total_cents bigint check (budget_total_cents is null or budget_total_cents >= 0),
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Permite que as tabelas filhas garantam, por chave estrangeira, que a obra
  -- é da mesma organização da linha.
  unique (id, org_id)
);

create index projects_org_id_idx on public.projects (org_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function private.set_updated_at();

-- Membros por obra (convidados só para uma obra) ----------------------------

create table public.project_members (
  project_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  org_id uuid not null,
  role public.project_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade,
  -- Quem é convidado para uma obra também é membro da organização (papel member).
  foreign key (org_id, user_id) references public.organization_members (org_id, user_id) on delete cascade
);

create index project_members_user_id_idx on public.project_members (user_id);

create trigger project_members_set_updated_at
  before update on public.project_members
  for each row execute function private.set_updated_at();

-- Funções de acesso por obra -------------------------------------------------
-- Dono e admin da organização veem e editam todas as obras. Os demais, só as
-- obras em que estão em project_members (editor edita, viewer só vê).

create or replace function private.can_view_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.organization_members m
      on m.org_id = p.org_id and m.user_id = (select auth.uid())
    where p.id = p_project_id
      and (
        m.role in ('owner', 'admin')
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = m.user_id
        )
      )
  );
$$;

create or replace function private.can_edit_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.organization_members m
      on m.org_id = p.org_id and m.user_id = (select auth.uid())
    where p.id = p_project_id
      and (
        m.role in ('owner', 'admin')
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id
            and pm.user_id = m.user_id
            and pm.role = 'editor'
        )
      )
  );
$$;

-- Pode criar dados da organização que não pertencem a uma obra só
-- (fornecedores, categorias próprias): dono, admin ou editor de alguma obra.
create or replace function private.can_write_org_data(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(p_org_id, array['owner', 'admin']::public.org_role[])
    or exists (
      select 1 from public.project_members pm
      where pm.org_id = p_org_id
        and pm.user_id = (select auth.uid())
        and pm.role = 'editor'
    );
$$;

revoke all on function private.can_view_project(uuid) from public;
revoke all on function private.can_edit_project(uuid) from public;
revoke all on function private.can_write_org_data(uuid) from public;
grant execute on function private.can_view_project(uuid) to authenticated, service_role;
grant execute on function private.can_edit_project(uuid) to authenticated, service_role;
grant execute on function private.can_write_org_data(uuid) to authenticated, service_role;

-- RLS: projects --------------------------------------------------------------

alter table public.projects enable row level security;

revoke all on table public.projects from anon;
revoke delete on table public.projects from authenticated;

-- A primeira condição usa só o org_id da própria linha: assim o
-- `insert ... returning` de quem acabou de criar a obra funciona (a função
-- can_view_project ainda não enxerga a linha nova dentro do mesmo comando).
create policy "Quem tem acesso vê a obra"
  on public.projects for select
  to authenticated
  using (
    private.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    or private.can_view_project(id)
  );

-- Só dono e admin criam obras. O limite do plano é checado no servidor
-- (src/lib/billing/limits.ts) antes do insert.
create policy "Dono e admin criam obras"
  on public.projects for insert
  to authenticated
  with check (
    private.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    and created_by = (select auth.uid())
  );

create policy "Quem edita a obra altera os dados dela"
  on public.projects for update
  to authenticated
  using (private.can_edit_project(id))
  with check (private.can_edit_project(id));

-- org_id e created_by nunca mudam depois de criados.
revoke update on table public.projects from authenticated;
grant update (
  name, address, city, state, built_area_m2, standard, start_date,
  expected_end_date, status, budget_total_cents, archived_at
) on table public.projects to authenticated;

-- RLS: project_members -------------------------------------------------------
-- Leitura para quem vê a obra. Escrita só pelo servidor até os convites (Fase 2).

alter table public.project_members enable row level security;

revoke all on table public.project_members from anon;
revoke insert, update, delete on table public.project_members from authenticated;

create policy "Quem vê a obra vê os membros dela"
  on public.project_members for select
  to authenticated
  using (private.can_view_project(project_id));

-- Modelos de etapa (global, só leitura) --------------------------------------

create table public.stage_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null,
  default_percent numeric(5, 2) not null check (default_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger stage_templates_set_updated_at
  before update on public.stage_templates
  for each row execute function private.set_updated_at();

alter table public.stage_templates enable row level security;

revoke insert, update, delete on table public.stage_templates from anon, authenticated;

create policy "Todos os usuários veem os modelos de etapa"
  on public.stage_templates for select
  to authenticated
  using (true);

-- Percentuais de referência, aproximados e editáveis (CLAUDE.md, seção 5).
insert into public.stage_templates (name, sort_order, default_percent) values
  ('Projetos e documentação', 1, 3),
  ('Serviços preliminares e terreno', 2, 2),
  ('Fundação', 3, 8),
  ('Estrutura', 4, 14),
  ('Alvenaria', 5, 10),
  ('Cobertura', 6, 9),
  ('Instalações elétricas', 7, 6),
  ('Instalações hidrossanitárias', 8, 6),
  ('Revestimentos e pisos', 9, 16),
  ('Esquadrias (portas e janelas)', 10, 9),
  ('Pintura', 11, 6),
  ('Louças, metais e acabamentos', 12, 8),
  ('Limpeza e entrega', 13, 3);

-- Etapas da obra ---------------------------------------------------------------

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  sort_order integer not null default 0,
  budget_cents bigint check (budget_cents is null or budget_cents >= 0),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  -- Percentual de referência copiado do modelo (estimativa paramétrica, Fase 2).
  default_percent numeric(5, 2) check (default_percent is null or default_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade,
  -- Permite que gastos garantam que a etapa é da mesma obra.
  unique (id, project_id)
);

create index stages_project_id_idx on public.stages (project_id, sort_order);

create trigger stages_set_updated_at
  before update on public.stages
  for each row execute function private.set_updated_at();

alter table public.stages enable row level security;

revoke all on table public.stages from anon;

create policy "Quem vê a obra vê as etapas"
  on public.stages for select
  to authenticated
  using (private.can_view_project(project_id));

create policy "Quem edita a obra cria etapas"
  on public.stages for insert
  to authenticated
  with check (private.can_edit_project(project_id));

create policy "Quem edita a obra altera etapas"
  on public.stages for update
  to authenticated
  using (private.can_edit_project(project_id))
  with check (private.can_edit_project(project_id));

create policy "Quem edita a obra remove etapas"
  on public.stages for delete
  to authenticated
  using (private.can_edit_project(project_id));

revoke update on table public.stages from authenticated;
grant update (name, sort_order, budget_cents, progress_percent) on table public.stages to authenticated;

-- Toda obra nova nasce com as etapas padrão (a pessoa renomeia, remove e
-- reordena depois).
create or replace function private.create_default_stages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stages (org_id, project_id, name, sort_order, default_percent)
  select new.org_id, new.id, t.name, t.sort_order, t.default_percent
  from public.stage_templates t
  order by t.sort_order;
  return new;
end;
$$;

revoke all on function private.create_default_stages() from public;

create trigger projects_create_default_stages
  after insert on public.projects
  for each row execute function private.create_default_stages();
