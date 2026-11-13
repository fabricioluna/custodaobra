-- CNPJ alfanumérico (emitido desde julho de 2026): os 12 primeiros caracteres
-- podem ter letras maiúsculas; os 2 verificadores continuam números. A chave
-- de acesso da NF-e/NFC-e traz o CNPJ do emitente nas posições 7 a 20, então
-- também passa a aceitar letras ali. O formato novo inclui o antigo: os dados
-- que já existem continuam valendo. Os verificadores são conferidos no código
-- (src/lib/documents.ts); aqui fica só o formato.

alter table public.suppliers
  drop constraint suppliers_document_check,
  add constraint suppliers_document_check check (
    document is null
    or document ~ '^[0-9]{11}$'
    or document ~ '^[0-9A-Z]{12}[0-9]{2}$'
  );

alter table public.expenses
  drop constraint expenses_nfe_access_key_check,
  add constraint expenses_nfe_access_key_check check (
    nfe_access_key is null
    or nfe_access_key ~ '^[0-9]{6}[0-9A-Z]{12}[0-9]{26}$'
  );
