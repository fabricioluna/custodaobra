-- WhatsApp (Fase 3, parte 1) ---------------------------------------------------
-- Código para ligar o número, conversas do bot, log de mensagens e contadores
-- de uso do plano. O webhook roda sem sessão (service_role); por isso as
-- tabelas do bot têm RLS ligado e nenhuma política para usuários.

-- Códigos para ligar o número -------------------------------------------------
-- O app gera 6 dígitos válidos por 15 minutos e guarda só o HMAC-SHA256 (hex)
-- com uma chave secreta do servidor. O bot recebe "VINCULAR 123456" e confere.

create table public.whatsapp_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '15 minutes')
);

-- Dois códigos ativos iguais deixariam o bot sem saber de quem é o número.
create unique index whatsapp_link_codes_active_hash_idx
  on public.whatsapp_link_codes (code_hash) where used_at is null;
create index whatsapp_link_codes_user_id_idx on public.whatsapp_link_codes (user_id);

create trigger whatsapp_link_codes_set_updated_at
  before update on public.whatsapp_link_codes
  for each row execute function private.set_updated_at();

alter table public.whatsapp_link_codes enable row level security;

revoke all on table public.whatsapp_link_codes from anon;
revoke insert, update, delete on table public.whatsapp_link_codes from authenticated;
-- Validade e uso não mudam pelo app: o padrão do banco vale.
grant insert (user_id, code_hash) on table public.whatsapp_link_codes to authenticated;
grant delete on table public.whatsapp_link_codes to authenticated;

create policy "Cada um vê os próprios códigos"
  on public.whatsapp_link_codes for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Cada um gera os próprios códigos"
  on public.whatsapp_link_codes for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Gerar um código novo apaga os anteriores ainda não usados.
create policy "Cada um apaga os próprios códigos não usados"
  on public.whatsapp_link_codes for delete
  to authenticated
  using (user_id = (select auth.uid()) and used_at is null);

-- Conversas do bot (estado por pessoa) ----------------------------------------

create type public.whatsapp_conversation_state as enum (
  'idle', 'awaiting_confirmation', 'awaiting_stage', 'awaiting_amount', 'awaiting_project'
);

create table public.whatsapp_conversations (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  active_org_id uuid references public.organizations (id) on delete set null,
  active_project_id uuid references public.projects (id) on delete set null,
  state public.whatsapp_conversation_state not null default 'idle',
  pending_expense_id uuid references public.expenses (id) on delete set null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger whatsapp_conversations_set_updated_at
  before update on public.whatsapp_conversations
  for each row execute function private.set_updated_at();

alter table public.whatsapp_conversations enable row level security;
revoke all on table public.whatsapp_conversations from anon, authenticated;

-- Log de mensagens --------------------------------------------------------------
-- wa_message_id único garante que a Meta reenviar a mesma mensagem não faz
-- nada duas vezes. org_id fica nulo quando o número não é de ninguém.

create type public.whatsapp_direction as enum ('in', 'out');

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  wa_message_id text not null unique,
  direction public.whatsapp_direction not null,
  from_phone text not null,
  user_id uuid references public.profiles (id) on delete set null,
  org_id uuid references public.organizations (id) on delete set null,
  type text not null,
  payload jsonb,
  expense_id uuid references public.expenses (id) on delete set null,
  processed_at timestamptz,
  -- Motivo de falha. 'link_code_invalid' conta para o limite de tentativas.
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_messages_from_phone_idx
  on public.whatsapp_messages (from_phone, created_at desc);
create index whatsapp_messages_org_id_idx on public.whatsapp_messages (org_id);
create index whatsapp_messages_user_id_idx on public.whatsapp_messages (user_id);
create index whatsapp_messages_expense_id_idx on public.whatsapp_messages (expense_id);

create trigger whatsapp_messages_set_updated_at
  before update on public.whatsapp_messages
  for each row execute function private.set_updated_at();

alter table public.whatsapp_messages enable row level security;
revoke all on table public.whatsapp_messages from anon, authenticated;

-- Contadores de uso do plano --------------------------------------------------------

create table public.usage_counters (
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- Primeiro dia do mês.
  month date not null check (extract(day from month) = 1),
  whatsapp_entries integer not null default 0 check (whatsapp_entries >= 0),
  ai_calls integer not null default 0 check (ai_calls >= 0),
  ai_input_tokens bigint not null default 0 check (ai_input_tokens >= 0),
  ai_output_tokens bigint not null default 0 check (ai_output_tokens >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, month)
);

create trigger usage_counters_set_updated_at
  before update on public.usage_counters
  for each row execute function private.set_updated_at();

alter table public.usage_counters enable row level security;
revoke all on table public.usage_counters from anon;
revoke insert, update, delete on table public.usage_counters from authenticated;

create policy "Dono e admin veem o uso da conta"
  on public.usage_counters for select
  to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

-- Soma ao contador do mês (cria a linha se preciso). Só o servidor chama.
create or replace function public.increment_usage(
  p_org_id uuid,
  p_month date,
  p_whatsapp_entries integer default 0,
  p_ai_calls integer default 0,
  p_ai_input_tokens bigint default 0,
  p_ai_output_tokens bigint default 0
)
returns void
language sql
set search_path = ''
as $$
  insert into public.usage_counters as u
    (org_id, month, whatsapp_entries, ai_calls, ai_input_tokens, ai_output_tokens)
  values (
    p_org_id, date_trunc('month', p_month)::date,
    p_whatsapp_entries, p_ai_calls, p_ai_input_tokens, p_ai_output_tokens
  )
  on conflict (org_id, month) do update set
    whatsapp_entries = u.whatsapp_entries + excluded.whatsapp_entries,
    ai_calls = u.ai_calls + excluded.ai_calls,
    ai_input_tokens = u.ai_input_tokens + excluded.ai_input_tokens,
    ai_output_tokens = u.ai_output_tokens + excluded.ai_output_tokens;
$$;

revoke all on function public.increment_usage(uuid, date, integer, integer, bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.increment_usage(uuid, date, integer, integer, bigint, bigint)
  to service_role;

-- Ligar o número ------------------------------------------------------------------
-- Numa operação só: confere o código, tira o número de outra conta que o tinha
-- (quem tem o celular e a conta no app provou as duas coisas), grava o wa_id
-- no perfil e marca o código como usado. Devolve o id da pessoa, ou nulo se o
-- código não vale. Só o servidor (webhook) chama.

create or replace function public.link_whatsapp(
  p_code_hash text,
  p_phone text,
  p_phone_variants text[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_code_id uuid;
  v_user_id uuid;
begin
  select c.id, c.user_id
    into v_code_id, v_user_id
  from public.whatsapp_link_codes c
  where c.code_hash = p_code_hash
    and c.used_at is null
    and c.expires_at > now()
  for update;

  if v_code_id is null then
    return null;
  end if;

  with previous as (
    update public.profiles
       set whatsapp_phone = null, whatsapp_linked_at = null
     where whatsapp_phone = any (p_phone_variants || p_phone)
       and id <> v_user_id
    returning id
  )
  delete from public.whatsapp_conversations c
   using previous
   where c.user_id = previous.id;

  update public.profiles
     set whatsapp_phone = p_phone, whatsapp_linked_at = now()
   where id = v_user_id;

  update public.whatsapp_link_codes
     set used_at = now()
   where id = v_code_id;

  -- Os outros códigos ainda abertos da pessoa não servem mais.
  delete from public.whatsapp_link_codes
   where user_id = v_user_id and used_at is null;

  return v_user_id;
end;
$$;

revoke all on function public.link_whatsapp(text, text, text[]) from public, anon, authenticated;
grant execute on function public.link_whatsapp(text, text, text[]) to service_role;

-- Desligar o número (Configurações > WhatsApp). Só mexe no próprio perfil.
create or replace function public.unlink_whatsapp()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;

  update public.profiles
     set whatsapp_phone = null, whatsapp_linked_at = null
   where id = (select auth.uid());

  delete from public.whatsapp_conversations
   where user_id = (select auth.uid());
end;
$$;

revoke all on function public.unlink_whatsapp() from public, anon;
grant execute on function public.unlink_whatsapp() to authenticated;
