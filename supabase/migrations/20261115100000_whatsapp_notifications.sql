-- Avisos pelo WhatsApp (fase 4, parte 5) --------------------------------------
-- Mensagens que o bot manda sem a pessoa ter escrito (alerta de orçamento e
-- resumo semanal) só saem por modelos aprovados pela Meta, que cobra por
-- mensagem. Por isso:
-- - cada pessoa liga ou desliga cada aviso no app (perfil);
-- - cada mensagem conta no uso do mês e o plano tem um teto;
-- - cada etapa guarda o último alerta mandado, para não repetir.

-- Preferências da pessoa ------------------------------------------------------
-- Ligadas por padrão: só recebe quem ligou o WhatsApp e é dono ou admin da
-- conta, e dá para desligar em Configurações > WhatsApp.

alter table public.profiles
  add column whatsapp_budget_alerts boolean not null default true,
  add column whatsapp_weekly_report boolean not null default true;

-- A política "Cada um edita o próprio perfil" já limita à própria linha.
grant update (whatsapp_budget_alerts, whatsapp_weekly_report)
  on table public.profiles to authenticated;

-- Plano e uso -------------------------------------------------------------------

alter table public.plans
  add column max_template_messages_month integer not null default 0
    check (max_template_messages_month >= 0);

-- Provisório, como os outros limites: dá para uma obra com alertas e o
-- resumo de toda semana para 2 pessoas, com folga.
update public.plans set max_template_messages_month = 60 where code = 'pessoal';
update public.plans set max_template_messages_month = 600 where code = 'profissional';

alter table public.usage_counters
  add column template_messages integer not null default 0
    check (template_messages >= 0);

-- Um parâmetro a mais muda a assinatura: a função antiga sai.
drop function public.increment_usage(uuid, date, integer, integer, bigint, bigint, integer);

create function public.increment_usage(
  p_org_id uuid,
  p_month date,
  p_whatsapp_entries integer default 0,
  p_ai_calls integer default 0,
  p_ai_input_tokens bigint default 0,
  p_ai_output_tokens bigint default 0,
  p_audio_seconds integer default 0,
  p_template_messages integer default 0
)
returns void
language sql
set search_path = ''
as $$
  insert into public.usage_counters as u
    (org_id, month, whatsapp_entries, ai_calls, ai_input_tokens,
     ai_output_tokens, audio_seconds, template_messages)
  values (
    p_org_id, date_trunc('month', p_month)::date,
    p_whatsapp_entries, p_ai_calls, p_ai_input_tokens, p_ai_output_tokens,
    p_audio_seconds, p_template_messages
  )
  on conflict (org_id, month) do update set
    whatsapp_entries = u.whatsapp_entries + excluded.whatsapp_entries,
    ai_calls = u.ai_calls + excluded.ai_calls,
    ai_input_tokens = u.ai_input_tokens + excluded.ai_input_tokens,
    ai_output_tokens = u.ai_output_tokens + excluded.ai_output_tokens,
    audio_seconds = u.audio_seconds + excluded.audio_seconds,
    template_messages = u.template_messages + excluded.template_messages;
$$;

revoke all on function public.increment_usage(uuid, date, integer, integer, bigint, bigint, integer, integer)
  from public, anon, authenticated;
grant execute on function public.increment_usage(uuid, date, integer, integer, bigint, bigint, integer, integer)
  to service_role;

-- Último alerta de orçamento por etapa ---------------------------------------
-- Uma linha por etapa com o nível já avisado ('warn' passou de 80%, 'over'
-- passou de 100%). O cron avisa quando o nível sobe; se a etapa volta a ficar
-- abaixo de 80% (previsto aumentado, gasto excluído), a linha sai e um novo
-- estouro avisa de novo.

create table public.budget_alerts (
  stage_id uuid primary key references public.stages (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  level text not null check (level in ('warn', 'over')),
  notified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budget_alerts_org_id_idx on public.budget_alerts (org_id);
create index budget_alerts_project_id_idx on public.budget_alerts (project_id);

create trigger budget_alerts_set_updated_at
  before update on public.budget_alerts
  for each row execute function private.set_updated_at();

-- Só o servidor (cron, com service_role) lê e grava, como o log do WhatsApp:
-- RLS ligado e nenhuma política para anon ou authenticated.
alter table public.budget_alerts enable row level security;
revoke all on table public.budget_alerts from anon, authenticated;
