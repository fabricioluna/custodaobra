/**
 * Documentos fiscais brasileiros: CNPJ, CPF e chave de acesso da NF-e/NFC-e.
 * Conferidos pelos dígitos verificadores, para um número lido errado (pela IA
 * ou digitado) não ser gravado como se fosse certo.
 *
 * Só a forma numérica: o banco hoje aceita CNPJ e chave só com dígitos.
 */

const onlyDigits = (value: string) => value.replace(/\D/g, "");

/** Dígito de módulo 11 com pesos dados (da esquerda para a direita). */
function mod11(digits: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * (weights[i] ?? 0);
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const first = mod11(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = mod11(
    cnpj.slice(0, 13),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return cnpj.endsWith(`${first}${second}`);
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const first = mod11(cpf.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = mod11(cpf.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cpf.endsWith(`${first}${second}`);
}

/** CNPJ ou CPF válido, só com os dígitos; senão, null. */
export function normalizeDocument(value: string | null): string | null {
  if (!value) return null;
  const digits = onlyDigits(value);
  if (digits.length === 14) return isValidCnpj(digits) ? digits : null;
  if (digits.length === 11) return isValidCpf(digits) ? digits : null;
  return null;
}

/**
 * Chave de acesso (44 dígitos, impressa em blocos de 4 no cupom). O último
 * dígito é o verificador: módulo 11 com pesos de 2 a 9, da direita para a
 * esquerda; resto 0 ou 1 dá 0. Válida, devolve só os dígitos; senão, null.
 */
export function normalizeAccessKey(value: string | null): string | null {
  if (!value) return null;
  const key = onlyDigits(value);
  if (key.length !== 44) return null;
  let sum = 0;
  let weight = 2;
  for (let i = 42; i >= 0; i--) {
    sum += Number(key[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  const check = rest < 2 ? 0 : 11 - rest;
  return Number(key[43]) === check ? key : null;
}
