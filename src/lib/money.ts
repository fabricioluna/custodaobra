/**
 * Dinheiro: sempre centavos inteiros (bigint no banco, number aqui).
 * Converter só na borda: entrada do usuário e exibição. Toda conversão fica
 * neste arquivo.
 */

/** Maior valor aceito num lançamento: menos de R$ 10 milhões. */
export const MAX_AMOUNT_CENTS = 999_999_999;

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 150050 → "R$ 1.500,50" (com espaço comum, não o espaço fino do Intl). */
export function formatCents(cents: number): string {
  return brl.format(cents / 100).replace(/\s/g, " ");
}

/** 150050000 → "R$ 1,5 mi". Para eixos e resumos curtos. */
export function formatCentsCompact(cents: number): string {
  return brlCompact.format(cents / 100).replace(/\s/g, " ");
}

/** 150050 → "1.500,50" (sem "R$"), para preencher campos. */
export function centsToInput(cents: number): string {
  return formatCents(cents).replace(/^-?R\$\s?/, "");
}

/**
 * Lê um valor digitado em reais e devolve centavos, ou null se não der para
 * entender. Aceita: "300", "1.500", "1.500,50", "R$ 39,90", "39.90", "1,5".
 * Regra do ponto sem vírgula: seguido de exatamente 3 dígitos é milhar
 * ("1.500" = mil e quinhentos); senão é decimal ("39.9" = 39,90).
 */
export function parseMoneyToCents(input: string): number | null {
  let value = input
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s/g, "");
  if (!value) return null;
  if (!/^\d[\d.,]*$/.test(value)) return null;

  if (value.includes(",")) {
    // Vírgula é o decimal; pontos são milhar.
    if (value.indexOf(",") !== value.lastIndexOf(",")) return null;
    const [intPart, decPart] = value.split(",");
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(intPart)) return null;
    if (!/^\d{0,2}$/.test(decPart)) return null;
    value = `${intPart.replace(/\./g, "")}.${decPart.padEnd(2, "0")}`;
  } else if (value.includes(".")) {
    const parts = value.split(".");
    const last = parts[parts.length - 1];
    if (parts.length > 2 || last.length === 3) {
      // Só milhar: "1.500", "1.500.000".
      if (!/^\d{1,3}(\.\d{3})+$/.test(value)) return null;
      value = value.replace(/\./g, "");
    } else if (!/^\d{1,2}$/.test(last)) {
      return null;
    }
  }

  const [intPart, decPart = ""] = value.split(".");
  const cents =
    Number(intPart) * 100 + Number(decPart.padEnd(2, "0").slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

/** Valor válido para um lançamento: maior que zero e menor que R$ 10 milhões. */
export function isValidAmountCents(cents: number): boolean {
  return Number.isInteger(cents) && cents > 0 && cents <= MAX_AMOUNT_CENTS;
}

/**
 * Campo de valor que se preenche da direita para a esquerda (como na
 * maquininha): só dígitos, os dois últimos são os centavos. "3" → 3 centavos,
 * "30000" → R$ 300,00. Rápido no teclado numérico, sem precisar de vírgula.
 */
export function digitsToCents(digits: string): number {
  const onlyDigits = digits.replace(/\D/g, "").replace(/^0+/, "");
  if (!onlyDigits) return 0;
  return Number(onlyDigits.slice(0, 11));
}

/** Quantidade × valor unitário, arredondado para o centavo. */
export function multiplyCents(
  unitPriceCents: number,
  quantity: number,
): number {
  return Math.round(unitPriceCents * quantity);
}

/** Lê uma quantidade como "20", "2,5" ou "1.000" (milheiro). */
export function parseQuantity(input: string): number | null {
  const value = input.trim().replace(/\s/g, "");
  if (!value) return null;
  let normalized: string;
  if (value.includes(",")) {
    normalized = value.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
    normalized = value.replace(/\./g, "");
  } else {
    normalized = value;
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const quantity = Number(normalized);
  return quantity > 0 && Number.isFinite(quantity) ? quantity : null;
}

/** 2.5 → "2,5"; 1000 → "1.000". */
export function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
    quantity,
  );
}
