-- Equipe e convites (Fase 2, parte 3) ------------------------------------------
-- Convite por link de uso único (7 dias): o app guarda só o hash do token.
-- Convite para a conta inteira entra como administrador; convite para uma obra
-- entra como membro da conta com papel na obra (editor ou viewer).
-- Dono e admin gerenciam a equipe; ninguém mexe no dono.

-- Auditoria: tabelas de membros não têm coluna id; usam o user_id ------------
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

  insert into public.audit_log (org_id, user_id, entity, entity_id, action, diff)
  values (
    v_org_id,
    (select auth.uid()),
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

-- Convites ---------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- Nulo = convite para a conta inteira (administrador).
  project_id uuid,
  org_role public.org_role not null,
  project_role public.project_role,
  -- Apelido para reconhecer o convite na lista ("Seu Zé, mestre de obras").
  label text check (label is null or char_length(btrim(label)) between 1 and 80),
  -- SHA-256 (hex) do token do link. O token em si nunca é guardado.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade,
  check (
    (project_id is null and org_role = 'admin' and project_role is null)
    or (project_id is not null and org_role = 'member' and project_role is not null)
  ),
  check (accepted_at is null or revoked_at is null)
);

create index invitations_org_id_idx on public.invitations (org_id, created_at desc);
create index invitations_project_id_idx on public.invitations (project_id);

create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function private.set_updated_at();

create trigger invitations_audit
  after insert or update on public.invitations
  for each row execute function private.audit_row();

alter table public.invitations enable row level security;

revoke all on table public.invitations from anon;
revoke insert, update, delete on table public.invitations from authenticated;
-- Validade, aceite e token não mudam pelo app; só dá para cancelar.
grant insert (org_id, project_id, org_role, project_role, label, token_hash, invited_by)
  on table public.invitations to authenticated;
grant update (revoked_at) on table public.invitations to authenticated;

create policy "Dono e admin veem os convites"
  on public.invitations for select
  to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

-- O limite de membros do plano é checado no servidor (limits.ts) antes.
create policy "Dono e admin convidam"
  on public.invitations for insert
  to authenticated
  with check (
    private.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    and invited_by = (select auth.uid())
  );

create policy "Dono e admin cancelam convites pendentes"
  on public.invitations for update
  to authenticated
  using (
    private.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    and accepted_at is null
    and revoked_at is null
  )
  with check (
    private.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    and revoked_at is not null
  );

-- Tela do convite (antes de entrar) ---------------------------------------------
-- Só o que a pessoa precisa para decidir: de quem, para onde e se ainda vale.
-- security definer: quem abre o link ainda não é da organização (e pode nem
-- estar logado). O token tem 256 bits; sem ele, nada é devolvido.
create or replace function public.get_invitation(p_token text)
returns table (
  org_name text,
  project_name text,
  inviter_name text,
  org_role public.org_role,
  project_role public.project_role,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.name,
    p.name,
    nullif(split_part(btrim(coalesce(pr.full_name, '')), ' ', 1), ''),
    i.org_role,
    i.project_role,
    case
      when i.revoked_at is not null then 'revoked'
      when i.accepted_at is not null then 'accepted'
      when i.expires_at <= now() then 'expired'
      else 'pending'
    end
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  left join public.projects p on p.id = i.project_id
  left join public.profiles pr on pr.id = i.invited_by
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

revoke all on function public.get_invitation(text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- Aceitar o convite ---------------------------------------------------------------
-- Cria o vínculo com a organização (sem rebaixar quem já é dono ou admin) e com
-- a obra, e marca o convite como usado, tudo de uma vez.
-- security definer: quem aceita ainda não é membro, então o RLS não deixaria.
create or replace function public.accept_invitation(p_token text)
returns table (org_slug text, project_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.invitations;
  v_role public.org_role;
  v_slug text;
  v_default_org uuid;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para aceitar o convite' using errcode = '42501';
  end if;

  select * into v_inv
  from public.invitations i
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;

  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;

  select o.slug into v_slug from public.organizations o where o.id = v_inv.org_id;

  if v_inv.accepted_at is not null then
    -- Abrir o mesmo link de novo, pela mesma pessoa, só leva para a obra.
    if v_inv.accepted_by = v_uid then
      return query select v_slug, v_inv.project_id;
      return;
    end if;
    raise exception 'invitation_used' using errcode = 'P0001';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'invitation_revoked' using errcode = 'P0001';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;

  select m.role into v_role
  from public.organization_members m
  where m.org_id = v_inv.org_id and m.user_id = v_uid;

  if v_role is null then
    insert into public.organization_members (org_id, user_id, role)
    values (v_inv.org_id, v_uid, v_inv.org_role);
  elsif v_role = 'member' and v_inv.org_role = 'admin' then
    update public.organization_members
    set role = 'admin'
    where org_id = v_inv.org_id and user_id = v_uid;
  end if;

  -- Dono e admin já veem todas as obras; o vínculo com a obra é para membro.
  if v_inv.project_id is not null and coalesce(v_role, 'member') = 'member' then
    insert into public.project_members (project_id, user_id, org_id, role)
    values (v_inv.project_id, v_uid, v_inv.org_id, v_inv.project_role)
    on conflict on constraint project_members_pkey do update
      set role = case
        when public.project_members.role = 'editor' then 'editor'::public.project_role
        else excluded.role
      end;
  end if;

  update public.invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_inv.id;

  -- Quem ainda não tem obra na conta padrão passa a abrir o app nesta conta.
  select pr.default_org_id into v_default_org
  from public.profiles pr where pr.id = v_uid;
  if v_default_org is null or not exists (
    select 1 from public.projects p
    where p.org_id = v_default_org and p.archived_at is null
  ) then
    update public.profiles set default_org_id = v_inv.org_id where id = v_uid;
  end if;

  return query select v_slug, v_inv.project_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

-- Equipe: lista para dono e admin -----------------------------------------------
-- profiles só mostra o próprio perfil; aqui dono e admin veem nome e e-mail de
-- quem tem acesso à conta, com as obras de cada um.
create or replace function public.org_team(p_org_id uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  role public.org_role,
  joined_at timestamptz,
  projects jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.user_id,
    pr.full_name,
    u.email::text,
    m.role,
    m.created_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('id', p.id, 'name', p.name, 'role', pm.role)
        order by p.name
      )
      from public.project_members pm
      join public.projects p on p.id = pm.project_id
      where pm.org_id = m.org_id and pm.user_id = m.user_id
    ), '[]'::jsonb)
  from public.organization_members m
  join public.profiles pr on pr.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.org_id = p_org_id
    and private.has_org_role(p_org_id, array['owner', 'admin']::public.org_role[])
  order by
    case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,
    pr.full_name nulls last,
    m.created_at;
$$;

revoke all on function public.org_team(uuid) from public, anon;
grant execute on function public.org_team(uuid) to authenticated;

-- RLS: gestão de membros da organização ------------------------------------------

grant update (role), delete on table public.organization_members to authenticated;

create trigger organization_members_audit
  after insert or update or delete on public.organization_members
  for each row execute function private.audit_row();

-- O dono não é alterado por ninguém e ninguém vira dono por aqui.
create policy "Dono e admin mudam papéis"
  on public.organization_members for update
  to authenticated
  using (
    private.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    and role <> 'owner'
  )
  with check (
    private.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    and role <> 'owner'
  );

create policy "Dono e admin removem pessoas; cada um pode sair"
  on public.organization_members for delete
  to authenticated
  using (
    role <> 'owner'
    and (
      private.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
      or user_id = (select auth.uid())
    )
  );

-- RLS: acesso por obra -----------------------------------------------------------

grant insert (project_id, user_id, org_id, role), update (role), delete
  on table public.project_members to authenticated;

create trigger project_members_audit
  after insert or update or delete on public.project_members
  for each row execute function private.audit_row();

-- As chaves estrangeiras garantem que a obra é da organização e que a pessoa
-- já é membro dela.
create policy "Dono e admin dão acesso a obras"
  on public.project_members for insert
  to authenticated
  with check (private.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy "Dono e admin mudam o papel na obra"
  on public.project_members for update
  to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin']::public.org_role[]))
  with check (private.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy "Dono e admin tiram o acesso; cada um pode sair"
  on public.project_members for delete
  to authenticated
  using (
    private.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    or user_id = (select auth.uid())
  );
