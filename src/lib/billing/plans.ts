/**
 * Chaves e prazos da cobrança. As regras ficam em limits.ts.
 */

/**
 * A cobrança recorrente está no ar? Enquanto for `false` (antes da integração
 * com o Asaas), o fim do teste e o pagamento atrasado não bloqueiam nada: não
 * haveria onde pagar. A tela do plano e o aviso do teste só falam de prazo
 * quando ela for `true`.
 */
export const BILLING_LIVE = false;

/** Dias de tolerância depois do vencimento de uma mensalidade não paga. */
export const PAST_DUE_GRACE_DAYS = 7;

/** A partir de quantos dias para o fim do teste o app avisa. */
export const TRIAL_WARNING_DAYS = 3;
