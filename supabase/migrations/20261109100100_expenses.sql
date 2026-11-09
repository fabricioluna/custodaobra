-- Categorias, fornecedores, lançamentos, anexos, registro de auditoria e
-- resumos para o painel da obra, com RLS.

-- Categorias ------------------------------------------------------------------
-- org_id nulo = categoria padrão do sistema (visível para todos).

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_system_code_idx on public.categories (code) where org_id is null;
create unique index categories_org_code_idx on public.categories (org_id, code) where org_id is not null;

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function private.set_updated_at();

alter table public.categories enable row level security;

revoke all on table public.categories from anon;
-- Categorias próprias da organização ficam para depois; por enquanto só leitura.
revoke insert, update, delete on table public.categories from authenticated;

create policy "Todos veem as categorias padrão e as da sua organização"
  on public.categories for select
  to authenticated
  using (org_id is null or private.is_org_member(org_id));

-- Ícones: nomes do lucide-react. "terreno" fica fora do custo da construção.
insert into public.categories (org_id, code, name, icon, sort_order) values
  (null, 'material', 'Material', 'package', 1),
  (null, 'mao_de_obra', 'Mão de obra', 'hard-hat', 2),
  (null, 'servico_terceirizado', 'Serviço terceirizado', 'handshake', 3),
  (null, 'aluguel_equipamentos', 'Aluguel de equipamentos', 'construction', 4),
  (null, 'frete', 'Frete', 'truck', 5),
  (null, 'taxas_documentacao', 'Taxas e documentação', 'file-text', 6),
  (null, 'terreno', 'Terreno', 'map-pin', 7),
  (null, 'outros', 'Outros', 'circle-ellipsis', 8);

-- Fornecedores ------------------------------------------------------------------

create type public.supplier_kind as enum ('loja', 'profissional', 'empresa', 'outro');

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  document text check (document is null or document ~ '^[0-9]{11}$|^[0-9]{14}$'),
  phone text check (phone is null or char_length(phone) <= 20),
  kind public.supplier_kind not null default 'outro',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);

-- Um nome por organização (sem diferenciar maiúsculas): "Loja do Zé" e
-- "loja do zé" são o mesmo fornecedor.
create unique index suppliers_org_name_idx on public.suppliers (org_id, lower(btrim(name)));

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function private.set_updated_at();

alter table public.suppliers enable row level security;

revoke all on table public.suppliers from anon;
revoke delete on table public.suppliers from authenticated;

create policy "Membros veem os fornecedores da organização"
  on public.suppliers for select
  to authenticated
  using (private.is_org_member(org_id));

create policy "Quem lança gastos cadastra fornecedores"
  on public.suppliers for insert
  to authenticated
  with check (private.can_write_org_data(org_id));

create policy "Quem lança gastos edita fornecedores"
  on public.suppliers for update
  to authenticated
  using (private.can_write_org_data(org_id))
  with check (private.can_write_org_data(org_id));

revoke update on table public.suppliers from authenticated;
grant update (name, document, phone, kind) on table public.suppliers to authenticated;

-- Lançamentos (gastos) ------------------------------------------------------------

create type public.payment_method as enum (
  'pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia', 'outro'
);
create type public.expense_status as enum ('pending', 'confirmed', 'cancelled');
create type public.expense_source as enum (
  'app', 'whatsapp_text', 'whatsapp_audio', 'whatsapp_image', 'import'
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  stage_id uuid,
  category_id uuid not null references public.categories (id),
  supplier_id uuid,
  description text not null check (char_length(btrim(description)) between 1 and 200),
  -- Centavos. Maior que zero e menor que R$ 10 milhões.
  amount_cents bigint not null check (amount_cents > 0 and amount_cents < 1000000000),
  quantity numeric(12, 3) check (quantity is null or quantity > 0),
  unit text check (unit is null or char_length(unit) <= 20),
  unit_price_cents bigint check (unit_price_cents is null or unit_price_cents > 0),
  spent_on date not null,
  payment_method public.payment_method,
  has_invoice boolean not null default false,
  invoice_number text check (invoice_number is null or char_length(invoice_number) <= 60),
  nfe_access_key text check (nfe_access_key is null or nfe_access_key ~ '^[0-9]{44}$'),
  status public.expense_status not null,
  source public.expense_source not null default 'app',
  raw_input text,
  ai_confidence numeric(3, 2) check (ai_confidence is null or ai_confidence between 0 and 1),
  -- Conta a pagar que originou o gasto (a tabela chega na Fase 2).
  payable_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade,
  -- A etapa precisa ser da mesma obra. Se a etapa for removida, o gasto fica
  -- "sem etapa" (vai para "Para classificar").
  foreign key (stage_id, project_id) references public.stages (id, project_id)
    on delete set null (stage_id),
  foreign key (supplier_id, org_id) references public.suppliers (id, org_id)
    on delete set null (supplier_id)
);

create index expenses_project_spent_on_idx on public.expenses (project_id, spent_on desc)
  where deleted_at is null;
create index expenses_stage_id_idx on public.expenses (stage_id);
create index expenses_supplier_id_idx on public.expenses (supplier_id);
create index expenses_org_id_idx on public.expenses (org_id);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function private.set_updated_at();

-- A categoria precisa ser do sistema ou da própria organização.
create or replace function private.validate_expense_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.categories c
    where c.id = new.category_id
      and (c.org_id is null or c.org_id = new.org_id)
  ) then
    raise exception 'Categoria inválida para esta organização'
      using errcode = '23503';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_expense_category() from public;

create trigger expenses_validate_category
  before insert or update of category_id on public.expenses
  for each row execute function private.validate_expense_category();

alter table public.expenses enable row level security;

revoke all on table public.expenses from anon;
-- Exclusão é sempre lógica (deleted_at).
revoke delete on table public.expenses from authenticated;

create policy "Quem vê a obra vê os gastos"
  on public.expenses for select
  to authenticated
  using (private.can_view_project(project_id));

create policy "Quem edita a obra lança gastos"
  on public.expenses for insert
  to authenticated
  with check (
    private.can_edit_project(project_id)
    and created_by = (select auth.uid())
  );

create policy "Quem edita a obra altera gastos"
  on public.expenses for update
  to authenticated
  using (private.can_edit_project(project_id))
  with check (private.can_edit_project(project_id));

-- Obra, organização, origem e autor não mudam depois do lançamento.
revoke update on table public.expenses from authenticated;
grant update (
  stage_id, category_id, supplier_id, description, amount_cents, quantity,
  unit, unit_price_cents, spent_on, payment_method, has_invoice,
  invoice_number, nfe_access_key, status, deleted_at
) on table public.expenses to authenticated;

-- Itens de um cupom (preenchidos pela leitura de foto, Fase 4) -----------------

create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  expense_id uuid not null references public.expenses (id) on delete cascade,
  description text not null check (char_length(description) <= 200),
  quantity numeric(12, 3),
  unit text check (unit is null or char_length(unit) <= 20),
  unit_price_cents bigint,
  total_cents bigint not null check (total_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expense_items_expense_id_idx on public.expense_items (expense_id);

create trigger expense_items_set_updated_at
  before update on public.expense_items
  for each row execute function private.set_updated_at();

alter table public.expense_items enable row level security;

revoke all on table public.expense_items from anon;
-- Escrita só pelo servidor (leitura de cupom). O usuário só lê.
revoke insert, update, delete on table public.expense_items from authenticated;

-- A subconsulta em expenses já passa pelo RLS de quem consulta.
create policy "Quem vê o gasto vê os itens"
  on public.expense_items for select
  to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id));

-- Comprovantes (anexos) -------------------------------------------------------------

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  expense_id uuid not null references public.expenses (id) on delete cascade,
  -- Caminho no bucket privado "comprovantes": org_id/expense_id/arquivo
  storage_path text not null unique,
  mime_type text not null
    check (mime_type ~ '^image/(jpeg|png|webp|heic|heif)$' or mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path like org_id::text || '/' || expense_id::text || '/%')
);

create index attachments_expense_id_idx on public.attachments (expense_id);

create trigger attachments_set_updated_at
  before update on public.attachments
  for each row execute function private.set_updated_at();

alter table public.attachments enable row level security;

revoke all on table public.attachments from anon;
revoke update on table public.attachments from authenticated;

create policy "Quem vê o gasto vê os comprovantes"
  on public.attachments for select
  to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id));

-- Pode mexer nos comprovantes do gasto: edita a obra dele e o gasto é da
-- organização informada.
create or replace function private.can_edit_expense(p_expense_id uuid, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.expenses e
    where e.id = p_expense_id
      and e.org_id = p_org_id
      and private.can_edit_project(e.project_id)
  );
$$;

create or replace function private.can_view_expense(p_expense_id uuid, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.expenses e
    where e.id = p_expense_id
      and e.org_id = p_org_id
      and private.can_view_project(e.project_id)
  );
$$;

revoke all on function private.can_edit_expense(uuid, uuid) from public;
revoke all on function private.can_view_expense(uuid, uuid) from public;
grant execute on function private.can_edit_expense(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_view_expense(uuid, uuid) to authenticated, service_role;

create policy "Quem edita a obra anexa comprovantes"
  on public.attachments for insert
  to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and private.can_edit_expense(expense_id, org_id)
  );

create policy "Quem edita a obra remove comprovantes"
  on public.attachments for delete
  to authenticated
  using (private.can_edit_expense(expense_id, org_id));

-- Registro de auditoria ---------------------------------------------------------------
-- Gravado por gatilho no banco, para nenhuma criação, edição ou exclusão
-- escapar, venha do app, do WhatsApp ou de onde for. Ninguém escreve direto.
-- org_id sem chave estrangeira de propósito: o registro não pode impedir que
-- uma organização seja apagada (a exclusão de conta apaga o registro junto).

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid references auth.users (id) on delete set null,
  entity text not null,
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete', 'restore')),
  diff jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_org_created_idx on public.audit_log (org_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

alter table public.audit_log enable row level security;

revoke all on table public.audit_log from anon;
revoke insert, update, delete on table public.audit_log from authenticated;

create policy "Dono e admin veem o registro de auditoria"
  on public.audit_log for select
  to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_org_id uuid;
  v_action text;
  v_diff jsonb;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_action := 'create';
    v_diff := v_new - 'created_at' - 'updated_at';
  elsif tg_op = 'UPDATE' then
    v_new := to_jsonb(new);
    v_old := to_jsonb(old);
    -- Só os campos que mudaram: {"campo": {"from": ..., "to": ...}}
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', v_old -> n.key, 'to', n.value)), '{}'::jsonb)
      into v_diff
    from jsonb_each(v_new) n
    where n.key not in ('updated_at', 'created_at')
      and n.value is distinct from v_old -> n.key;
    if v_diff = '{}'::jsonb then
      return null;
    end if;
    v_action := case
      when v_diff ? 'deleted_at' and v_old ->> 'deleted_at' is null then 'delete'
      when v_diff ? 'deleted_at' and v_new ->> 'deleted_at' is null then 'restore'
      else 'update'
    end;
  else
    v_old := to_jsonb(old);
    v_action := 'delete';
    v_diff := v_old - 'created_at' - 'updated_at';
  end if;

  v_org_id := coalesce(v_new ->> 'org_id', v_old ->> 'org_id')::uuid;

  -- Remoção em cascata de uma organização inteira: nada a registrar.
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations o where o.id = v_org_id) then
    return null;
  end if;

  insert into public.audit_log (org_id, user_id, entity, entity_id, action, diff)
  values (
    v_org_id,
    (select auth.uid()),
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id')::uuid,
    v_action,
    v_diff
  );
  return null;
end;
$$;

revoke all on function private.audit_row() from public;

create trigger projects_audit
  after insert or update on public.projects
  for each row execute function private.audit_row();

create trigger stages_audit
  after insert or update or delete on public.stages
  for each row execute function private.audit_row();

create trigger expenses_audit
  after insert or update on public.expenses
  for each row execute function private.audit_row();

create trigger suppliers_audit
  after insert or update on public.suppliers
  for each row execute function private.audit_row();

create trigger attachments_audit
  after insert or delete on public.attachments
  for each row execute function private.audit_row();

-- Ao apagar uma organização, o registro de auditoria dela vai junto.
create or replace function private.delete_org_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.audit_log where org_id = old.id;
  return null;
end;
$$;

revoke all on function private.delete_org_audit_log() from public;

create trigger organizations_delete_audit_log
  after delete on public.organizations
  for each row execute function private.delete_org_audit_log();

-- Resumos para o painel ------------------------------------------------------------------
-- security_invoker: as views respeitam o RLS de quem consulta.
-- Só entram lançamentos confirmados e não apagados. "Terreno" fica fora do
-- custo da construção e do realizado das etapas (CLAUDE.md, seção 5).

create view public.v_stage_summary
with (security_invoker = true)
as
select
  s.id as stage_id,
  s.org_id,
  s.project_id,
  s.name,
  s.sort_order,
  s.budget_cents,
  s.progress_percent,
  coalesce(sum(e.amount_cents), 0)::bigint as spent_cents,
  -- Contas a pagar em aberto entram na Fase 2.
  0::bigint as committed_cents,
  count(e.id)::integer as expense_count
from public.stages s
left join (
  public.expenses e
  join public.categories c on c.id = e.category_id
)
  on e.stage_id = s.id
  and e.status = 'confirmed'
  and e.deleted_at is null
  and c.code <> 'terreno'
group by s.id;

create view public.v_project_summary
with (security_invoker = true)
as
select
  p.id as project_id,
  p.org_id,
  coalesce(sum(e.amount_cents) filter (where c.code <> 'terreno'), 0)::bigint as construction_cents,
  coalesce(sum(e.amount_cents) filter (where c.code = 'terreno'), 0)::bigint as land_cents,
  count(e.id) filter (where e.stage_id is null and c.code <> 'terreno')::integer as unclassified_count,
  count(e.id)::integer as expense_count,
  max(e.spent_on) as last_spent_on
from public.projects p
left join (
  public.expenses e
  join public.categories c on c.id = e.category_id
)
  on e.project_id = p.id
  and e.status = 'confirmed'
  and e.deleted_at is null
group by p.id;

create view public.v_project_category_summary
with (security_invoker = true)
as
select
  e.project_id,
  e.org_id,
  c.id as category_id,
  c.code as category_code,
  c.name as category_name,
  c.sort_order as category_sort_order,
  sum(e.amount_cents)::bigint as total_cents,
  count(e.id)::integer as expense_count
from public.expenses e
join public.categories c on c.id = e.category_id
where e.status = 'confirmed' and e.deleted_at is null
group by e.project_id, e.org_id, c.id;

create view public.v_project_month_summary
with (security_invoker = true)
as
select
  e.project_id,
  e.org_id,
  date_trunc('month', e.spent_on)::date as month,
  coalesce(sum(e.amount_cents) filter (where c.code <> 'terreno'), 0)::bigint as construction_cents,
  coalesce(sum(e.amount_cents) filter (where c.code = 'terreno'), 0)::bigint as land_cents
from public.expenses e
join public.categories c on c.id = e.category_id
where e.status = 'confirmed' and e.deleted_at is null
group by e.project_id, e.org_id, date_trunc('month', e.spent_on);

revoke all on public.v_stage_summary from anon;
revoke all on public.v_project_summary from anon;
revoke all on public.v_project_category_summary from anon;
revoke all on public.v_project_month_summary from anon;
grant select on public.v_stage_summary to authenticated;
grant select on public.v_project_summary to authenticated;
grant select on public.v_project_category_summary to authenticated;
grant select on public.v_project_month_summary to authenticated;
