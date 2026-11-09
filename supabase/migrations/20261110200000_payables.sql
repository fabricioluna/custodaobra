-- Contas a pagar (Fase 2) --------------------------------------------------------
-- Parcelas e boletos da obra. Uma conta paga vira um gasto (expenses) e guarda
-- o vínculo nos dois sentidos: payables.paid_expense_id e expenses.payable_id.
-- Contas abertas entram como "a pagar" (comprometido) no previsto x realizado.

create type public.payable_status as enum ('open', 'paid', 'cancelled');

-- O gasto do pagamento precisa ser da mesma obra da conta.
alter table public.expenses
  add constraint expenses_id_project_id_key unique (id, project_id);

create table public.payables (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  stage_id uuid,
  category_id uuid not null references public.categories (id),
  supplier_id uuid,
  description text not null check (char_length(btrim(description)) between 1 and 200),
  -- Centavos. Maior que zero e menor que R$ 10 milhões.
  amount_cents bigint not null check (amount_cents > 0 and amount_cents < 1000000000),
  due_date date not null,
  status public.payable_status not null default 'open',
  -- Parcelas criadas juntas compartilham o grupo (nulo = conta avulsa).
  installment_group_id uuid,
  installment_number integer,
  installment_total integer,
  paid_expense_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id),
  check (
    (installment_group_id is null and installment_number is null and installment_total is null)
    or (
      installment_group_id is not null
      and installment_total between 2 and 120
      and installment_number between 1 and installment_total
    )
  ),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade,
  foreign key (stage_id, project_id) references public.stages (id, project_id)
    on delete set null (stage_id),
  foreign key (supplier_id, org_id) references public.suppliers (id, org_id)
    on delete set null (supplier_id),
  foreign key (paid_expense_id, project_id) references public.expenses (id, project_id)
    on delete set null (paid_expense_id)
);

create index payables_project_due_idx on public.payables (project_id, due_date)
  where status = 'open';
create index payables_org_due_idx on public.payables (org_id, due_date)
  where status = 'open';
create index payables_stage_id_idx on public.payables (stage_id);
create index payables_supplier_id_idx on public.payables (supplier_id);
create index payables_paid_expense_id_idx on public.payables (paid_expense_id);
create index payables_installment_group_idx on public.payables (installment_group_id)
  where installment_group_id is not null;

-- Gasto -> conta que o originou.
alter table public.expenses
  add constraint expenses_payable_fkey
  foreign key (payable_id, project_id) references public.payables (id, project_id)
  on delete set null (payable_id);

create index expenses_payable_id_idx on public.expenses (payable_id);

create trigger payables_set_updated_at
  before update on public.payables
  for each row execute function private.set_updated_at();

-- Mesma regra dos gastos: categoria do sistema ou da própria organização.
create trigger payables_validate_category
  before insert or update of category_id on public.payables
  for each row execute function private.validate_expense_category();

-- Uma conta só fica "paga" apontando para o gasto que a pagou, e esse gasto
-- precisa apontar de volta para ela. Evita conta paga sem gasto (e sumir do
-- "a pagar" sem entrar no realizado).
create or replace function private.validate_payable_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Valida ao virar "paga" ou ao trocar o gasto. Zerar o vínculo (remoção em
  -- cascata da obra inteira) passa.
  if new.status = 'paid'
    and (
      tg_op = 'INSERT'
      or old.status is distinct from 'paid'
      or (new.paid_expense_id is not null and new.paid_expense_id is distinct from old.paid_expense_id)
    )
  then
    if new.paid_expense_id is null or not exists (
      select 1 from public.expenses e
      where e.id = new.paid_expense_id
        and e.payable_id = new.id
        and e.deleted_at is null
        and e.status = 'confirmed'
    ) then
      raise exception 'Conta paga precisa do gasto do pagamento'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.validate_payable_payment() from public;

create trigger payables_validate_payment
  before insert or update of status, paid_expense_id on public.payables
  for each row execute function private.validate_payable_payment();

create trigger payables_audit
  after insert or update on public.payables
  for each row execute function private.audit_row();

alter table public.payables enable row level security;

revoke all on table public.payables from anon;
-- Nada é apagado de verdade: conta que não vale mais fica "cancelled".
revoke delete on table public.payables from authenticated;

create policy "Quem vê a obra vê as contas"
  on public.payables for select
  to authenticated
  using (private.can_view_project(project_id));

create policy "Quem edita a obra cadastra contas"
  on public.payables for insert
  to authenticated
  with check (
    private.can_edit_project(project_id)
    and created_by = (select auth.uid())
    and status = 'open'
    and paid_expense_id is null
  );

create policy "Quem edita a obra altera contas"
  on public.payables for update
  to authenticated
  using (private.can_edit_project(project_id))
  with check (private.can_edit_project(project_id));

-- Obra, organização, parcelamento e autor não mudam depois do cadastro.
revoke update on table public.payables from authenticated;
grant update (
  stage_id, category_id, supplier_id, description, amount_cents, due_date,
  status, paid_expense_id
) on table public.payables to authenticated;

-- Marcar como paga --------------------------------------------------------------------
-- Cria o gasto do pagamento (confirmado) e marca a conta como paga, tudo de uma
-- vez. Valor e data podem diferir da conta (juros, desconto, pagou atrasado).
-- security invoker: o RLS de payables e expenses decide quem pode.
create or replace function public.pay_payable(
  p_payable_id uuid,
  p_paid_on date,
  p_amount_cents bigint default null,
  p_payment_method public.payment_method default null,
  p_has_invoice boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payable public.payables;
  v_expense_id uuid;
begin
  select * into v_payable
  from public.payables
  where id = p_payable_id
  for update;

  if not found then
    raise exception 'Conta não encontrada' using errcode = 'P0002';
  end if;
  if v_payable.status <> 'open' then
    raise exception 'Esta conta não está em aberto' using errcode = 'P0001';
  end if;

  insert into public.expenses (
    org_id, project_id, stage_id, category_id, supplier_id, description,
    amount_cents, spent_on, payment_method, has_invoice, status, source,
    payable_id, created_by
  ) values (
    v_payable.org_id, v_payable.project_id, v_payable.stage_id,
    v_payable.category_id, v_payable.supplier_id,
    left(
      v_payable.description || case
        when v_payable.installment_total is not null
          then format(' (parcela %s/%s)', v_payable.installment_number, v_payable.installment_total)
        else ''
      end,
      200
    ),
    coalesce(p_amount_cents, v_payable.amount_cents), p_paid_on,
    p_payment_method, coalesce(p_has_invoice, false), 'confirmed', 'app',
    v_payable.id, (select auth.uid())
  )
  returning id into v_expense_id;

  update public.payables
  set status = 'paid', paid_expense_id = v_expense_id
  where id = v_payable.id;

  return v_expense_id;
end;
$$;

revoke all on function public.pay_payable(uuid, date, bigint, public.payment_method, boolean) from public, anon;
grant execute on function public.pay_payable(uuid, date, bigint, public.payment_method, boolean) to authenticated;

-- Gasto do pagamento excluído ou cancelado: a conta volta a ficar em aberto.
-- security definer: a pessoa já pôde mexer no gasto (RLS de expenses); aqui
-- só se desfaz o vínculo da conta que apontava para ele.
create or replace function private.reopen_payable_on_expense_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payable_id is not null
    and (
      (new.deleted_at is not null and old.deleted_at is null)
      or (new.status = 'cancelled' and old.status is distinct from 'cancelled')
    )
  then
    update public.payables
    set status = 'open', paid_expense_id = null
    where id = new.payable_id
      and paid_expense_id = new.id
      and status = 'paid';
  end if;
  return null;
end;
$$;

revoke all on function private.reopen_payable_on_expense_removal() from public;

create trigger expenses_reopen_payable
  after update of deleted_at, status on public.expenses
  for each row execute function private.reopen_payable_on_expense_removal();

-- Previsto x realizado: "a pagar" passa a somar as contas abertas da etapa.
-- Terreno fica fora, como no realizado.
create or replace view public.v_stage_summary
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
  coalesce((
    select sum(p.amount_cents)
    from public.payables p
    join public.categories pc on pc.id = p.category_id
    where p.stage_id = s.id
      and p.status = 'open'
      and pc.code <> 'terreno'
  ), 0)::bigint as committed_cents,
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
