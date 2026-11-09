-- Base: esquema privado para funções auxiliares e gatilho de updated_at.
--
-- O esquema "private" não é exposto pela API do Supabase (só "public" é),
-- então as funções daqui não podem ser chamadas direto pelo navegador.

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create extension if not exists unaccent with schema extensions;

-- Atualiza updated_at em todo UPDATE. Usado por todas as tabelas.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
