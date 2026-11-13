/**
 * Documentos fiscais brasileiros: CNPJ, CPF e chave de acesso da NF-e/NFC-e.
 * Conferidos pelos dígitos verificadores, para um número lido errado (pela IA
 * ou digitado) não ser gravado como se fosse certo.
 *
 * CNPJ alfanumérico (emitido desde julho de 2026): os 12 primeiros caracteres
 * podem ter letras maiúsculas; os 2 verificadores continuam números. O cálculo
 * é o mesmo módulo 11, com cada caractere valendo o código ASCII menos 48
 * ("0" = 0 ... "9" = 9, "A" = 17, "B" = 18 ... "Z" = 42). Para os números, dá
 * exatamente a conta antiga. A chave de acesso traz o CNPJ do emitente nas
 * posições 7 a 20, então também pode ter letras ali, com o mesmo cálculo.
 */

const onlyDigits = (value: string) => value.replace(/\D/g, "");

/**
 * Só letras (maiúsculas) e números. Tira antes um rótulo que venha junto
 * ("CNPJ: ...", "Chave de acesso ..."), para as letras dele não entrarem.
 */
function onlyAlphanumeric(value: string): string {
  return value
    .toUpperCase()
    .replace(/\b(CNPJ|CPF|CHAVE(\s+DE\s+ACESSO)?)\b\s*:?/g, "")
    .replace(/[^0-9A-Z]/g, "");
}

/** Valor do caractere no cálculo: código ASCII menos 48. */
const charValue = (char: string) => char.charCodeAt(0) - 48;

/** Dígito de módulo 11 com pesos dados (da esquerda para a direita). */
function mod11(chars: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < chars.length; i++) {
    sum += charValue(chars[i]) * (weights[i] ?? 0);
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

const CNPJ_SHAPE = /^[0-9A-Z]{12}[0-9]{2}$/;
const ACCESS_KEY_SHAPE = /^[0-9]{6}[0-9A-Z]{12}[0-9]{26}$/;

/** CNPJ já só com letras maiúsculas e números. */
function checkCnpj(cnpj: string): boolean {
  if (!CNPJ_SHAPE.test(cnpj) || /^(.)\1+$/.test(cnpj)) return false;
  const first = mod11(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = mod11(
    cnpj.slice(0, 13),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return cnpj.endsWith(`${first}${second}`);
}

export function isValidCnpj(value: string): boolean {
  return checkCnpj(onlyAlphanumeric(value));
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const first = mod11(cpf.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = mod11(cpf.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cpf.endsWith(`${first}${second}`);
}

/**
 * CNPJ (numérico ou alfanumérico) ou CPF válido, sem pontuação e com letras
 * maiúsculas; senão, null.
 */
export function normalizeDocument(value: string | null): string | null {
  if (!value) return null;
  const doc = onlyAlphanumeric(value);
  if (doc.length === 14) return checkCnpj(doc) ? doc : null;
  if (doc.length === 11) return isValidCpf(doc) ? doc : null;
  return null;
}

/**
 * Chave de acesso (44 caracteres, impressa em blocos de 4 no cupom). O último
 * é o verificador: módulo 11 com pesos de 2 a 9, da direita para a esquerda;
 * resto 0 ou 1 dá 0. Válida, devolve sem espaços e com letras maiúsculas;
 * senão, null.
 */
export function normalizeAccessKey(value: string | null): string | null {
  if (!value) return null;
  const key = onlyAlphanumeric(value);
  if (!ACCESS_KEY_SHAPE.test(key)) return null;
  let sum = 0;
  let weight = 2;
  for (let i = 42; i >= 0; i--) {
    sum += charValue(key[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  const check = rest < 2 ? 0 : 11 - rest;
  return Number(key[43]) === check ? key : null;
}
