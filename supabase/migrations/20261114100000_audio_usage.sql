-- Áudio pelo WhatsApp (fase 4, parte 3) ----------------------------------------
-- A transcrição (Whisper da Groq) é cobrada por segundo de áudio, com mínimo
-- de 10 s por arquivo, e não gasta tokens do Claude. Os segundos ficam numa
-- coluna própria do uso do mês: a leitura do gasto que vem depois conta como
-- chamada de IA normal, e o custo de cada serviço fica separado.

alter table public.usage_counters
  add column audio_seconds integer not null default 0 check (audio_seconds >= 0);

-- Um parâmetro a mais muda a assinatura: a função antiga sai para não ficarem
-- duas versões (com os padrões, a chamada ficaria ambígua).
drop function public.increment_usage(uuid, date, integer, integer, bigint, bigint);

create function public.increment_usage(
  p_org_id uuid,
  p_month date,
  p_whatsapp_entries integer default 0,
  p_ai_calls integer default 0,
  p_ai_input_tokens bigint default 0,
  p_ai_output_tokens bigint default 0,
  p_audio_seconds integer default 0
)
returns void
language sql
set search_path = ''
as $$
  insert into public.usage_counters as u
    (org_id, month, whatsapp_entries, ai_calls, ai_input_tokens,
     ai_output_tokens, audio_seconds)
  values (
    p_org_id, date_trunc('month', p_month)::date,
    p_whatsapp_entries, p_ai_calls, p_ai_input_tokens, p_ai_output_tokens,
    p_audio_seconds
  )
  on conflict (org_id, month) do update set
    whatsapp_entries = u.whatsapp_entries + excluded.whatsapp_entries,
    ai_calls = u.ai_calls + excluded.ai_calls,
    ai_input_tokens = u.ai_input_tokens + excluded.ai_input_tokens,
    ai_output_tokens = u.ai_output_tokens + excluded.ai_output_tokens,
    audio_seconds = u.audio_seconds + excluded.audio_seconds;
$$;

revoke all on function public.increment_usage(uuid, date, integer, integer, bigint, bigint, integer)
  from public, anon, authenticated;
grant execute on function public.increment_usage(uuid, date, integer, integer, bigint, bigint, integer)
  to service_role;
