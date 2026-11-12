-- Exclusão da própria conta (LGPD, CLAUDE.md seção 10).
--
-- A pessoa chama com a própria sessão: nada de service_role. Antes, o app
-- apaga pela API do Storage os comprovantes das contas de que ela é dona (o
-- Storage não deixa apagar arquivos por SQL; a política do bucket já permite
-- ao dono). Aqui, numa transação só:
--   1. apaga as organizações de que ela é dona (cada conta tem um único dono);
--      obras, gastos, contas, convites, assinatura, uso e auditoria vão em
--      cascata, e quem foi convidado para elas perde o acesso;
--   2. apaga o log do WhatsApp dela (mensagens com o número ou o usuário);
--   3. apaga o login em auth.users; perfil, vínculos com outras contas, códigos
--      e conversa do WhatsApp vão em cascata, e nos dados das outras contas o
--      autor fica nulo (created_by, invited_by, audit_log.user_id).

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_phone text;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;

  select whatsapp_phone into v_phone from public.profiles where id = v_uid;

  -- Daqui em diante a auditoria fica sem autor (como as tarefas do sistema):
  -- as remoções em cascata do login gravariam em audit_log o próprio usuário
  -- que está sendo apagado, e a chave estrangeira recusaria. Só nesta transação.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('app.audit_system', 'on', true);

  delete from public.organizations o
   using public.organization_members m
   where m.org_id = o.id
     and m.user_id = v_uid
     and m.role = 'owner';

  delete from public.whatsapp_messages
   where user_id = v_uid
      or (v_phone is not null and from_phone = v_phone);

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
