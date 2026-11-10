-- Tarefas agendadas do WhatsApp (Fase 3, parte 4) -------------------------------
-- Chamadas pelo cron diário da Vercel (rotas em src/app/api/cron/), com o
-- service_role. Cada uma é uma operação só no banco e devolve quantas linhas
-- mexeu, para o log da rota.

-- Lançamentos pendentes com mais de 24 h viram cancelados (CLAUDE.md, seção 5).
-- A conversa que esperava por um deles volta ao começo, para os botões velhos
-- não ficarem pendurados. O gatilho de auditoria registra cada cancelamento.
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

revoke all on function public.expire_pending_expenses(interval) from public, anon, authenticated;
grant execute on function public.expire_pending_expenses(interval) to service_role;

-- Log do WhatsApp: depois de 90 dias o conteúdo (payload) é apagado e fica só
-- o vínculo com o lançamento (CLAUDE.md, seção 10). Códigos de vínculo
-- vencidos há mais de um dia também saem.
create or replace function public.purge_whatsapp_log(
  p_older_than interval default interval '90 days'
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.whatsapp_messages
     set payload = null
   where payload is not null
     and created_at < now() - p_older_than;
  get diagnostics v_count = row_count;

  delete from public.whatsapp_link_codes
   where expires_at < now() - interval '1 day';

  return v_count;
end;
$$;

revoke all on function public.purge_whatsapp_log(interval) from public, anon, authenticated;
grant execute on function public.purge_whatsapp_log(interval) to service_role;

-- O "desfazer" do bot procura o último lançamento confirmado da pessoa.
create index if not exists expenses_created_by_updated_at_idx
  on public.expenses (created_by, updated_at desc)
  where deleted_at is null;
