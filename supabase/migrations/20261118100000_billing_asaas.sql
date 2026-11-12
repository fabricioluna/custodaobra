-- Cobrança recorrente pelo Asaas (fase 5, parte 4).
--
-- O app (com a sessão de dono ou admin) guarda o cliente e a assinatura que
-- criou no Asaas por funções security definer; quem muda a situação da
-- assinatura (em dia, atrasada, cancelada) é o webhook do Asaas, pelo
-- servidor (service_role, sem sessão, sempre filtrando pela assinatura).

-- Plano que vale quando o próximo pagamento da assinatura do Asaas for
-- confirmado (escolhido ao assinar ou ao trocar de plano).
alter table public.subscriptions
  add column provider_plan_code text references public.plans (code);

-- Uma assinatura do Asaas pertence a uma conta só.
create unique index subscriptions_provider_subscription_idx
  on public.subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;

-- Eventos recebidos do Asaas, para não processar o mesmo duas vezes (a
-- entrega é "pelo menos uma vez"). Só o servidor lê e escreve.
create table public.billing_events (
  id text primary key,
  provider text not null,
  event text not null,
  org_id uuid references public.organizations (id) on delete set null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger billing_events_set_updated_at
  before update on public.billing_events
  for each row execute function private.set_updated_at();

alter table public.billing_events enable row level security;
revoke all on table public.billing_events from anon, authenticated;

create index billing_events_org_idx on public.billing_events (org_id);

-- Guarda o cliente do Asaas da conta (só se ainda não houver um).
create or replace function public.billing_set_customer(
  p_org_id uuid,
  p_customer_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_org_role(p_org_id, array['owner', 'admin']::public.org_role[]) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  update public.subscriptions
  set provider = 'asaas', provider_customer_id = p_customer_id
  where org_id = p_org_id
    and (provider_customer_id is null or provider_customer_id = p_customer_id);
  if not found then
    raise exception 'conta já tem outro cliente no Asaas' using errcode = 'P0001';
  end if;
end;
$$;

-- Guarda a assinatura do Asaas e o plano escolhido. O plano só passa a valer
-- quando o webhook confirmar o pagamento.
create or replace function public.billing_set_subscription(
  p_org_id uuid,
  p_subscription_id text,
  p_plan_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_org_role(p_org_id, array['owner', 'admin']::public.org_role[]) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.plans
    where code = p_plan_code and active and price_cents_month > 0
  ) then
    raise exception 'plano inválido' using errcode = '22023';
  end if;
  update public.subscriptions
  set provider = 'asaas',
      provider_subscription_id = p_subscription_id,
      provider_plan_code = p_plan_code
  where org_id = p_org_id and provider_customer_id is not null;
  if not found then
    raise exception 'conta sem cliente no Asaas' using errcode = 'P0001';
  end if;
end;
$$;

-- Depois de remover a assinatura no Asaas: fica cancelada, mas vale até o
-- fim do período já pago (ou do teste).
create or replace function public.billing_mark_cancelled(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_org_role(p_org_id, array['owner', 'admin']::public.org_role[]) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  update public.subscriptions
  set status = 'cancelled',
      provider_subscription_id = null,
      provider_plan_code = null
  where org_id = p_org_id;
end;
$$;

revoke all on function public.billing_set_customer(uuid, text) from public, anon;
revoke all on function public.billing_set_subscription(uuid, text, text) from public, anon;
revoke all on function public.billing_mark_cancelled(uuid) from public, anon;
grant execute on function public.billing_set_customer(uuid, text) to authenticated;
grant execute on function public.billing_set_subscription(uuid, text, text) to authenticated;
grant execute on function public.billing_mark_cancelled(uuid) to authenticated;
