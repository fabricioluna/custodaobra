-- Condições de lançamento (decididas em 2026-11-14): plano Pessoal a R$ 24,90
-- e 7 dias de teste em todos os planos. Vale para contas novas; quem já está
-- no teste continua com a data de fim que recebeu no cadastro.
update public.plans set price_cents_month = 2490 where code = 'pessoal';
update public.plans set trial_days = 7;
alter table public.plans alter column trial_days set default 7;
