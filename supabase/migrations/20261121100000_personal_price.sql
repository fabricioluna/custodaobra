-- Preço de lançamento do plano Pessoal (decidido em 2026-11-12): R$ 19,90.
-- Migration nova em vez de editar a `plan_prices`, que já foi aplicada no `dev`.
update public.plans set price_cents_month = 1990 where code = 'pessoal';
