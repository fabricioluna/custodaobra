-- Preços dos planos (decididos em 2026-11-12). Enquanto a cobrança não está
-- no ar (BILLING_LIVE = false), o preço só aparece na página inicial e na
-- tela do plano; ninguém é cobrado nem bloqueado.
update public.plans set price_cents_month = 2490 where code = 'pessoal';
update public.plans set price_cents_month = 7990 where code = 'profissional';
