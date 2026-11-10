/**
 * Números do WhatsApp. A Meta manda o `wa_id` só com dígitos (ex.:
 * 5581999998888). Em números brasileiros antigos ele pode vir sem o nono
 * dígito do celular (558199998888). Guardamos o número exatamente como veio,
 * mas, para achar a pessoa, comparamos as duas formas.
 */

/** Só os dígitos (tira +, espaços, parênteses e traços). */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Formas equivalentes de um número: ele mesmo e, se for celular brasileiro,
 * a versão com ou sem o nono dígito. Fixos (começam com 2 a 5) não mudam.
 */
export function phoneVariants(phone: string): string[] {
  const digits = normalizePhone(phone);
  if (!digits) return [];
  const variants = [digits];

  if (digits.startsWith("55")) {
    const area = digits.slice(2, 4);
    const local = digits.slice(4);
    if (
      local.length === 9 &&
      local[0] === "9" &&
      /[6-9]/.test(local[1] ?? "")
    ) {
      variants.push(`55${area}${local.slice(1)}`);
    } else if (local.length === 8 && /[6-9]/.test(local[0] ?? "")) {
      variants.push(`55${area}9${local}`);
    }
  }
  return variants;
}

/** Os dois números são o mesmo (considerando o nono dígito)? */
export function samePhone(a: string, b: string): boolean {
  const other = normalizePhone(b);
  return other !== "" && phoneVariants(a).includes(other);
}

/** Para mostrar na tela: +55 (81) 99999-8888. Outros países: +dígitos. */
export function formatPhone(phone: string): string {
  const digits = normalizePhone(phone);
  if (
    digits.startsWith("55") &&
    (digits.length === 12 || digits.length === 13)
  ) {
    const area = digits.slice(2, 4);
    const local = digits.slice(4);
    const split = local.length - 4;
    return `+55 (${area}) ${local.slice(0, split)}-${local.slice(split)}`;
  }
  return `+${digits}`;
}
