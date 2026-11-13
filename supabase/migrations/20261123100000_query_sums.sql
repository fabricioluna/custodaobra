-- 1) Somas das perguntas do WhatsApp no banco. Antes, o servidor lia os gastos
--    em páginas de 1000 e somava no código; agora vem uma linha por grupo.
--    Só o servidor (service_role, webhook sem sessão) chama, sempre com
--    org_id e project_id explícitos, como as outras consultas do bot.
-- 2) admin_orgs aceita uma conta só (p_org_id), para a página de detalhe do
--    painel não ler todas.

create function public.expense_totals(
  p_org_id uuid,
  p_project_id uuid,
  p_group_by text default null,
  p_from date default null,
  p_to date default null,
  p_stage_id uuid default null,
  p_category_ids uuid[] default null,
  p_supplier_ids uuid[] default null,
  p_payment_method public.payment_method default null,
  p_search text default null
)
returns table (label text, cents bigint, land_cents bigint, expense_count bigint)
language sql
stable
set search_path = ''
as $$
  select
    case p_group_by
      when 'stage' then s.name
      when 'category' then coalesce(c.code, 'outros')
      when 'supplier' then sup.name
      when 'month' then to_char(e.spent_on, 'YYYY-MM')
    end,
    sum(e.amount_cents)::bigint,
    coalesce(sum(e.amount_cents) filter (where c.code = 'terreno'), 0)::bigint,
    count(*)
  from public.expenses e
  left join public.stages s on s.id = e.stage_id
  left join public.categories c on c.id = e.category_id
  left join public.suppliers sup on sup.id = e.supplier_id
  where e.org_id = p_org_id
    and e.project_id = p_project_id
    and e.status = 'confirmed'
    and e.deleted_at is null
    and (p_from is null or e.spent_on >= p_from)
    and (p_to is null or e.spent_on <= p_to)
    and (p_stage_id is null or e.stage_id = p_stage_id)
    and (p_category_ids is null or e.category_id = any (p_category_ids))
    and (p_supplier_ids is null or e.supplier_id = any (p_supplier_ids))
    and (p_payment_method is null or e.payment_method = p_payment_method)
    -- p_search já vem como padrão do ILIKE, com os curingas escapados.
    and (p_search is null or e.description ilike p_search)
  group by 1;
$$;

revoke all on function public.expense_totals(
  uuid, uuid, text, date, date, uuid, uuid[], uuid[], public.payment_method, text
) from public, anon, authenticated;
grant execute on function public.expense_totals(
  uuid, uuid, text, date, date, uuid, uuid[], uuid[], public.payment_method, text
) to service_role;

-- admin_orgs com filtro opcional por conta (mudar a assinatura exige recriar).
drop function public.admin_orgs(date);

create function public.admin_orgs(p_month date, p_org_id uuid default null)
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
  where p_org_id is null or o.id = p_org_id
  order by o.created_at desc;
end;
$$;

revoke all on function public.admin_orgs(date, uuid) from public, anon;
grant execute on function public.admin_orgs(date, uuid) to authenticated;
