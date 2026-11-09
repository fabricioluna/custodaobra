/**
 * Palpite de categoria pela descrição, para o formulário já vir certo na
 * maioria dos casos. Pagamento a pessoa (pedreiro, servente…) sem menção a
 * material vira Mão de obra (CLAUDE.md, seção 7). É só um palpite: a pessoa
 * vê e pode trocar antes de salvar.
 */

export type CategoryCode =
  | "material"
  | "mao_de_obra"
  | "servico_terceirizado"
  | "aluguel_equipamentos"
  | "frete"
  | "taxas_documentacao"
  | "terreno"
  | "outros";

const RULES: { code: CategoryCode; pattern: RegExp }[] = [
  {
    code: "terreno",
    pattern: /\b(itbi|escritura|lote|compra do terreno|terreno comprado)\b/,
  },
  {
    code: "taxas_documentacao",
    pattern:
      /\b(taxa|taxas|alvara|art|rrt|cartorio|prefeitura|habite[ -]?se|licenca|registro|iptu|cno|inss da obra)\b/,
  },
  {
    code: "aluguel_equipamentos",
    pattern:
      /\b(aluguel|alugue[il]|betoneira|andaime|cacamba|compactador|escora|escoras)\b/,
  },
  {
    code: "frete",
    pattern: /\b(frete|carreto|entrega|transporte)\b/,
  },
  {
    code: "mao_de_obra",
    pattern:
      /\b(pedreiro|pedreiros|servente|serventes|ajudante|eletricista|encanador|bombeiro hidraulico|pintor|carpinteiro|armador|gesseiro|azulejista|mestre|mestre de obras|diaria|diarias|diarista|empreita|empreitada|mao de obra|marceneiro|serralheiro|vidraceiro|soldador)\b/,
  },
];

/** Palavras que indicam material: "diária do pedreiro" é mão de obra, "tinta do pintor" não. */
const MATERIAL_HINTS =
  /\b(saco|sacos|cimento|areia|brita|tijolo|tijolos|bloco|blocos|milheiro|ferro|vergalhao|tinta|piso|porcelanato|argamassa|cal|telha|telhas|tubo|tubos|cano|canos|fio|fios|cabo|madeira|prego|pregos|massa|rejunte|carrada|m3|m2|lata|latas)\b/;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/³/g, "3")
    .replace(/²/g, "2");
}

export function guessCategoryCode(description: string): CategoryCode | null {
  const text = normalize(description);
  if (!text.trim()) return null;
  for (const { code, pattern } of RULES) {
    if (!pattern.test(text)) continue;
    if (code === "mao_de_obra" && MATERIAL_HINTS.test(text)) return "material";
    return code;
  }
  return MATERIAL_HINTS.test(text) ? "material" : null;
}
