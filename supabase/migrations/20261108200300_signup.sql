-- Cadastro: todo usuário novo (Google ou link mágico) ganha, na mesma
-- transação, perfil, organização pessoal da qual é dono e assinatura em teste
-- no plano padrão.

create or replace function private.slugify(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(lower(extensions.unaccent(coalesce(input, ''))), '[^a-z0-9]+', '-', 'g'),
    '-'
  );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
  v_org_name text;
  v_base_slug text;
  v_slug text;
  v_org_id uuid;
  v_plan_code text;
  v_trial_days integer;
begin
  -- Nome vindo do Google (full_name ou name). Pelo link mágico não vem nome.
  v_full_name := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), '');

  -- Nome provisório da conta: o nome da pessoa ou o começo do e-mail.
  -- A pessoa confirma ou troca no primeiro acesso.
  v_org_name := coalesce(v_full_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Minha conta');
  v_org_name := left(v_org_name, 80);

  insert into public.profiles (id, full_name)
  values (new.id, left(v_full_name, 120));

  v_base_slug := left(private.slugify(v_org_name), 40);
  v_base_slug := btrim(v_base_slug, '-');
  if char_length(v_base_slug) < 3 then
    v_base_slug := 'conta';
  end if;

  -- Sufixo aleatório curto para o endereço ficar único: fabricio-3f9a.
  loop
    v_slug := v_base_slug || '-' || substr(md5(gen_random_uuid()::text), 1, 4);
    exit when not exists (select 1 from public.organizations o where o.slug = v_slug);
  end loop;

  insert into public.organizations (name, slug, kind, created_by)
  values (v_org_name, v_slug, 'personal', new.id)
  returning id into v_org_id;

  insert into public.organization_members (org_id, user_id, role)
  values (v_org_id, new.id, 'owner');

  update public.profiles set default_org_id = v_org_id where id = new.id;

  select p.code, p.trial_days
    into v_plan_code, v_trial_days
  from public.plans p
  where p.is_default and p.active;

  if v_plan_code is null then
    raise exception 'Nenhum plano padrão ativo em public.plans';
  end if;

  insert into public.subscriptions (org_id, plan_code, status, trial_ends_at)
  values (v_org_id, v_plan_code, 'trialing', now() + make_interval(days => v_trial_days));

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
