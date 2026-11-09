-- Bucket privado dos comprovantes. Caminho: org_id/expense_id/arquivo.
-- Acesso só por URL assinada de curta duração, gerada no servidor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprovantes',
  'comprovantes',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do nothing;

-- Extrai org_id e expense_id do caminho do arquivo. Caminho fora do padrão
-- devolve nulo (e o acesso é negado).
create or replace function private.receipt_path_ids(p_name text, out org_id uuid, out expense_id uuid)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_org text := split_part(p_name, '/', 1);
  v_expense text := split_part(p_name, '/', 2);
begin
  if v_org ~ v_uuid and v_expense ~ v_uuid and split_part(p_name, '/', 3) <> '' then
    org_id := v_org::uuid;
    expense_id := v_expense::uuid;
  end if;
end;
$$;

grant execute on function private.receipt_path_ids(text) to authenticated, service_role;

create policy "Quem vê o gasto baixa o comprovante"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'comprovantes'
    and private.can_view_expense(
      (private.receipt_path_ids(name)).expense_id,
      (private.receipt_path_ids(name)).org_id
    )
  );

create policy "Quem edita a obra envia o comprovante"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'comprovantes'
    and private.can_edit_expense(
      (private.receipt_path_ids(name)).expense_id,
      (private.receipt_path_ids(name)).org_id
    )
  );

create policy "Quem edita a obra apaga o comprovante"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'comprovantes'
    and private.can_edit_expense(
      (private.receipt_path_ids(name)).expense_id,
      (private.receipt_path_ids(name)).org_id
    )
  );
