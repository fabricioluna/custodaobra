-- Revisão da Fase 3 ----------------------------------------------------------------
-- 1. expenses.confirmed_at: hora em que o gasto foi confirmado. O "desfazer"
--    do bot usa esta hora (updated_at muda a cada edição no app).
-- 2. Auditoria das mudanças feitas pelo bot (service_role, sem sessão) com o
--    autor do lançamento em vez de nulo; o cron fica sem autor.

-- Sem preenchimento retroativo: gastos antigos não cabem mais nos 10 minutos
-- do "desfazer", e atualizar todos geraria uma linha de auditoria para cada.
alter table public.expenses add column confirmed_at timestamptz;

create or replace function private.set_expense_confirmed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'confirmed'
     and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    new.confirmed_at := now();
  elsif new.status <> 'confirmed' then
    new.confirmed_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.set_expense_confirmed_at() from public;

create trigger expenses_set_confirmed_at
  before insert or update of status on public.expenses
  for each row execute function private.set_expense_confirmed_at();

-- O índice da parte 4 (por updated_at) dá lugar ao da confirmação.
drop index if exists public.expenses_created_by_updated_at_idx;
create index expenses_created_by_confirmed_at_idx
  on public.expenses (created_by, confirmed_at desc)
  where status = 'confirmed' and deleted_at is null;

-- Auditoria -----------------------------------------------------------------------

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
  v_user_id uuid;
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

  -- Quem fez: a pessoa logada. Sem sessão (bot do WhatsApp, que só mexe nos
  -- gastos que a própria pessoa lançou), quem criou a linha; tarefas do
  -- sistema (cron) marcam app.audit_system e ficam sem autor.
  v_user_id := coalesce(
    (select auth.uid()),
    case
      when coalesce(current_setting('app.audit_system', true), '') = 'on' then null
      else (coalesce(v_new, v_old) ->> 'created_by')::uuid
    end
  );

  insert into public.audit_log (org_id, user_id, entity, entity_id, action, diff)
  values (
    v_org_id,
    v_user_id,
    tg_table_name,
    coalesce(
      v_new ->> 'id', v_old ->> 'id',
      v_new ->> 'user_id', v_old ->> 'user_id'
    )::uuid,
    v_action,
    v_diff
  );
  return null;
end;
$$;

revoke all on function private.audit_row() from public;

-- Cron de pendentes: marca a operação como do sistema.
create or replace function public.expire_pending_expenses(
  p_older_than interval default interval '24 hours'
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- Cancelamento do sistema: a auditoria fica sem autor.
  perform set_config('app.audit_system', 'on', true);

  with expired as (
    update public.expenses
       set status = 'cancelled'
     where status = 'pending'
       and deleted_at is null
       and created_at < now() - p_older_than
    returning id
  ), reset as (
    update public.whatsapp_conversations c
       set state = 'idle', pending_expense_id = null, context = '{}'::jsonb
      from expired
     where c.pending_expense_id = expired.id
    returning c.user_id
  )
  select count(*) into v_count from expired;

  -- Rascunho sem valor (só na conversa, sem gasto criado) também expira.
  update public.whatsapp_conversations
     set state = 'idle', context = '{}'::jsonb
   where state = 'awaiting_amount'
     and pending_expense_id is null
     and updated_at < now() - p_older_than;

  return v_count;
end;
$$;

