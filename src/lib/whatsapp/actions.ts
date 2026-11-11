/**
 * Ids dos botões e das opções de lista que o bot manda. Voltam no webhook
 * quando a pessoa toca, então carregam o que é preciso para agir (até 256
 * caracteres). Formato curto: "c:<gasto>", "st:<etapa|none>:<gasto>" etc.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const DATE = "\\d{4}-\\d{2}-\\d{2}";

export const EDIT_FIELDS = [
  "amount",
  "stage",
  "category",
  "date",
  "description",
  "supplier",
  "payment",
  "invoice",
  "project",
  "split",
] as const;
export type EditField = (typeof EDIT_FIELDS)[number];

/**
 * Lista de etapas em dois modos: "confirm" (primeira pergunta: escolher a
 * etapa já confirma o lançamento) e "edit" (troca a etapa e volta ao resumo).
 */
export type StageMode = "confirm" | "edit";

export type BotAction =
  | { type: "confirm"; expenseId: string }
  | { type: "cancel"; expenseId: string }
  | { type: "edit"; expenseId: string }
  | { type: "edit_field"; field: EditField; expenseId: string }
  | {
      type: "stage";
      mode: StageMode;
      stageId: string | null;
      expenseId: string;
    }
  | { type: "stage_page"; mode: StageMode; page: number; expenseId: string }
  | { type: "category"; code: string; expenseId: string }
  | { type: "date"; date: string; expenseId: string }
  | { type: "payment"; method: string | null; expenseId: string }
  | { type: "invoice"; hasInvoice: boolean; expenseId: string }
  | { type: "move"; projectId: string; expenseId: string }
  /** Dividir a nota por etapa: lançar, ajustar (lista de itens) ou não. */
  | { type: "split_do"; expenseId: string }
  | { type: "split_no"; expenseId: string }
  | { type: "split_adjust"; page: number; expenseId: string }
  /** Item escolhido para mudar a etapa (`page`: página da lista de etapas). */
  | { type: "split_item"; itemId: string; page: number; expenseId: string }
  | {
      type: "split_stage";
      stageId: string | null;
      itemId: string;
      expenseId: string;
    }
  | { type: "project"; projectId: string }
  | { type: "project_page"; page: number };

const modeCode = (mode: StageMode) => (mode === "confirm" ? "c" : "e");

export const actionId = {
  confirm: (expenseId: string) => `c:${expenseId}`,
  cancel: (expenseId: string) => `x:${expenseId}`,
  edit: (expenseId: string) => `e:${expenseId}`,
  editField: (field: EditField, expenseId: string) =>
    `ef:${field}:${expenseId}`,
  stage: (mode: StageMode, stageId: string | null, expenseId: string) =>
    `st:${modeCode(mode)}:${stageId ?? "none"}:${expenseId}`,
  stagePage: (mode: StageMode, page: number, expenseId: string) =>
    `sp:${modeCode(mode)}:${page}:${expenseId}`,
  category: (code: string, expenseId: string) => `ca:${code}:${expenseId}`,
  date: (date: string, expenseId: string) => `d:${date}:${expenseId}`,
  payment: (method: string | null, expenseId: string) =>
    `pm:${method ?? "none"}:${expenseId}`,
  invoice: (hasInvoice: boolean, expenseId: string) =>
    `nf:${hasInvoice ? 1 : 0}:${expenseId}`,
  move: (projectId: string, expenseId: string) =>
    `mv:${projectId}:${expenseId}`,
  splitDo: (expenseId: string) => `sd:${expenseId}`,
  splitNo: (expenseId: string) => `sn:${expenseId}`,
  splitAdjust: (page: number, expenseId: string) => `sa:${page}:${expenseId}`,
  splitItem: (itemId: string, page: number, expenseId: string) =>
    `si:${itemId}:${page}:${expenseId}`,
  splitStage: (stageId: string | null, itemId: string, expenseId: string) =>
    `ss:${stageId ?? "none"}:${itemId}:${expenseId}`,
  project: (projectId: string) => `p:${projectId}`,
  projectPage: (page: number) => `pp:${page}`,
};

const PATTERNS: [RegExp, (m: RegExpExecArray) => BotAction][] = [
  [new RegExp(`^c:(${UUID})$`), (m) => ({ type: "confirm", expenseId: m[1]! })],
  [new RegExp(`^x:(${UUID})$`), (m) => ({ type: "cancel", expenseId: m[1]! })],
  [new RegExp(`^e:(${UUID})$`), (m) => ({ type: "edit", expenseId: m[1]! })],
  [
    new RegExp(`^ef:(${EDIT_FIELDS.join("|")}):(${UUID})$`),
    (m) => ({
      type: "edit_field",
      field: m[1] as EditField,
      expenseId: m[2]!,
    }),
  ],
  [
    new RegExp(`^st:([ce]):(${UUID}|none):(${UUID})$`),
    (m) => ({
      type: "stage",
      mode: m[1] === "c" ? "confirm" : "edit",
      stageId: m[2] === "none" ? null : m[2]!,
      expenseId: m[3]!,
    }),
  ],
  [
    new RegExp(`^sp:([ce]):(\\d{1,2}):(${UUID})$`),
    (m) => ({
      type: "stage_page",
      mode: m[1] === "c" ? "confirm" : "edit",
      page: Number(m[2]),
      expenseId: m[3]!,
    }),
  ],
  [
    new RegExp(`^ca:([a-z_]{1,40}):(${UUID})$`),
    (m) => ({ type: "category", code: m[1]!, expenseId: m[2]! }),
  ],
  [
    new RegExp(`^d:(${DATE}):(${UUID})$`),
    (m) => ({ type: "date", date: m[1]!, expenseId: m[2]! }),
  ],
  [
    new RegExp(`^pm:([a-z_]{1,40}):(${UUID})$`),
    (m) => ({
      type: "payment",
      method: m[1] === "none" ? null : m[1]!,
      expenseId: m[2]!,
    }),
  ],
  [
    new RegExp(`^nf:([01]):(${UUID})$`),
    (m) => ({ type: "invoice", hasInvoice: m[1] === "1", expenseId: m[2]! }),
  ],
  [
    new RegExp(`^mv:(${UUID}):(${UUID})$`),
    (m) => ({ type: "move", projectId: m[1]!, expenseId: m[2]! }),
  ],
  [
    new RegExp(`^sd:(${UUID})$`),
    (m) => ({ type: "split_do", expenseId: m[1]! }),
  ],
  [
    new RegExp(`^sn:(${UUID})$`),
    (m) => ({ type: "split_no", expenseId: m[1]! }),
  ],
  [
    new RegExp(`^sa:(\\d{1,2}):(${UUID})$`),
    (m) => ({ type: "split_adjust", page: Number(m[1]), expenseId: m[2]! }),
  ],
  [
    new RegExp(`^si:(${UUID}):(\\d{1,2}):(${UUID})$`),
    (m) => ({
      type: "split_item",
      itemId: m[1]!,
      page: Number(m[2]),
      expenseId: m[3]!,
    }),
  ],
  [
    new RegExp(`^ss:(${UUID}|none):(${UUID}):(${UUID})$`),
    (m) => ({
      type: "split_stage",
      stageId: m[1] === "none" ? null : m[1]!,
      itemId: m[2]!,
      expenseId: m[3]!,
    }),
  ],
  [new RegExp(`^p:(${UUID})$`), (m) => ({ type: "project", projectId: m[1]! })],
  [/^pp:(\d{1,2})$/, (m) => ({ type: "project_page", page: Number(m[1]) })],
];

/** Lê o id que voltou do toque; null se não for nosso (ou adulterado). */
export function parseAction(id: string | null | undefined): BotAction | null {
  if (!id) return null;
  for (const [pattern, build] of PATTERNS) {
    const match = pattern.exec(id);
    if (match) return build(match);
  }
  return null;
}
