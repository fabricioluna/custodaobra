/**
 * Gera cupons, notas e recibos FICTÍCIOS para a avaliação da leitura de
 * comprovantes (tests/ai/read-receipt.eval.test.ts). Nenhum dado é de pessoa
 * ou empresa real: nomes inventados e CNPJs/chaves montados só para ter os
 * dígitos verificadores certos.
 *
 * Uso: node scripts/generate-receipts.mjs
 * Saída: tests/fixtures/receipts/*.png|pdf e tests/fixtures/receipts.json
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const OUT = path.join("tests", "fixtures", "receipts");

// Cada caractere vale o código ASCII menos 48 ("A" = 17): serve para o CNPJ
// alfanumérico e, nos números, dá a conta de sempre.
const value = (char) => char.charCodeAt(0) - 48;
function mod11(digits, weights) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) sum += value(digits[i]) * weights[i];
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}
function cnpj(base12) {
  const a = mod11(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const b = mod11(`${base12}${a}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base12}${a}${b}`;
}
function accessKey(base43) {
  let sum = 0;
  let weight = 2;
  for (let i = base43.length - 1; i >= 0; i--) {
    sum += value(base43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return `${base43}${rest < 2 ? 0 : 11 - rest}`;
}
const fmtCnpj = (c) =>
  `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
const blocks = (key) => key.match(/.{1,4}/g).join(" ");
const brl = (cents) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const CNPJ_LOJA = cnpj("112223330001");
const CNPJ_ELETRICA = cnpj("456789120001");
const CNPJ_MADEIREIRA = cnpj("987654320001");
// CNPJ alfanumérico (emitido desde julho de 2026).
const CNPJ_HIDRAULICA = cnpj("7KQ3RZ1X0001");

const KEY_LOJA = accessKey(`262611${CNPJ_LOJA}65001000012345100012345`);
const KEY_ELETRICA = accessKey(`262611${CNPJ_ELETRICA}65002000045678100045678`);
const KEY_HIDRAULICA = accessKey(
  `262611${CNPJ_HIDRAULICA}65001000007788100007788`,
);
const KEY_MADEIREIRA = accessKey(
  `262610${CNPJ_MADEIREIRA}55001000003210100003210`,
);

const paper = `
  body { margin: 0; background: #d9d4c7; font-family: "Courier New", monospace; }
  .sheet { background: #fbfaf5; width: 330px; margin: 24px; padding: 18px 16px;
    font-size: 12px; line-height: 1.35; color: #222; box-shadow: 0 1px 4px #0003; }
  .c { text-align: center; } .b { font-weight: bold; } .r { text-align: right; }
  hr { border: 0; border-top: 1px dashed #555; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  td { vertical-align: top; padding: 1px 0; }
  .qr { width: 96px; height: 96px; margin: 8px auto; background:
    repeating-linear-gradient(90deg,#222 0 6px,#fff 6px 9px),
    repeating-linear-gradient(0deg,#222 0 5px,#fff 5px 11px);
    background-blend-mode: multiply; }
`;

function nfce({
  store,
  cnpjNum,
  address,
  items,
  payment,
  date,
  number,
  serie,
  key,
  discount = 0,
}) {
  const subtotal = items.reduce((t, i) => t + i.qty * i.unit, 0);
  const total = subtotal - discount;
  const rows = items
    .map(
      (
        i,
        n,
      ) => `<tr><td>${String(n + 1).padStart(3, "0")} ${i.code}</td><td colspan="3">${i.desc}</td></tr>
      <tr><td></td><td>${String(i.qty).replace(".", ",")} ${i.un} x ${brl(i.unit)}</td><td></td><td class="r">${brl(i.qty * i.unit)}</td></tr>`,
    )
    .join("");
  return {
    total,
    html: `<div class="sheet">
    <div class="c b">${store.toUpperCase()}</div>
    <div class="c">CNPJ: ${fmtCnpj(cnpjNum)} IE: 0123456-78</div>
    <div class="c">${address}</div>
    <hr><div class="c b">DANFE NFC-e - Documento Auxiliar<br>da Nota Fiscal de Consumidor Eletrônica</div><hr>
    <table><tr><td>#</td><td>DESCRIÇÃO</td><td></td><td class="r">VL TOTAL</td></tr>${rows}</table>
    <hr>
    <table>
      <tr><td>QTD. TOTAL DE ITENS</td><td class="r">${items.length}</td></tr>
      <tr><td>VALOR TOTAL R$</td><td class="r">${brl(subtotal)}</td></tr>
      ${discount ? `<tr><td>DESCONTO R$</td><td class="r">${brl(discount)}</td></tr>` : ""}
      <tr><td class="b">VALOR A PAGAR R$</td><td class="r b">${brl(total)}</td></tr>
      <tr><td>FORMA DE PAGAMENTO</td><td class="r">VALOR PAGO</td></tr>
      <tr><td>${payment}</td><td class="r">${brl(total)}</td></tr>
    </table>
    <hr>
    <div class="c">Consulte pela Chave de Acesso em<br>nfce.sefaz.pe.gov.br/consulta</div>
    <div class="c b">${blocks(key)}</div>
    <hr>
    <div class="c">CONSUMIDOR NÃO IDENTIFICADO</div>
    <div class="c">NFC-e nº ${number} Série ${serie} ${date} 10:42:13</div>
    <div class="c">Protocolo de autorização: 126260000123456</div>
    <div class="qr"></div>
    <div class="c">Tributos totais incidentes (Lei 12.741/2012): R$ ${brl(Math.round(total * 0.18))}</div>
  </div>`,
  };
}

const lojaItems = [
  {
    code: "7891",
    desc: "CIMENTO CP II-F 32 50KG",
    qty: 4,
    un: "SC",
    unit: 3890,
  },
  { code: "2201", desc: "AREIA MEDIA LAVADA", qty: 1, un: "M3", unit: 13500 },
  { code: "3302", desc: "BRITA 1", qty: 0.5, un: "M3", unit: 16000 },
];
const loja = nfce({
  store: "Mat. de Construção Boa Vista Ltda",
  cnpjNum: CNPJ_LOJA,
  address: "Av. Fictícia, 100 - Centro - Recife/PE",
  items: lojaItems,
  payment: "PIX",
  date: "06/11/2026",
  number: "000012345",
  serie: "001",
  key: KEY_LOJA,
});

const eletrica = nfce({
  store: "Elétrica Luz do Bairro Eireli",
  cnpjNum: CNPJ_ELETRICA,
  address: "Rua Inventada, 45 - Boa Viagem - Recife/PE",
  items: [
    {
      code: "1001",
      desc: "CABO FLEX 2,5MM AZUL ROLO 100M",
      qty: 2,
      un: "RL",
      unit: 28990,
    },
    {
      code: "1002",
      desc: "DISJUNTOR DIN MONOP 20A",
      qty: 6,
      un: "UN",
      unit: 1890,
    },
    {
      code: "1003",
      desc: "TOMADA 2P+T 10A BRANCA",
      qty: 10,
      un: "UN",
      unit: 1250,
    },
    {
      code: "1004",
      desc: "ELETRODUTO CORRUG 3/4 50M",
      qty: 1,
      un: "RL",
      unit: 8900,
    },
  ],
  payment: "CARTAO DE DEBITO",
  date: "09/11/2026",
  number: "000045678",
  serie: "002",
  key: KEY_ELETRICA,
  discount: 1500,
});

const recibo = {
  html: `<div class="sheet" style="width:420px;font-family:Georgia,serif;font-size:14px;line-height:1.6">
    <div class="c b" style="font-size:20px">RECIBO</div>
    <div class="r b">R$ 1.800,00</div>
    <p>Recebi de <b>Fulana de Tal</b> a importância de <b>um mil e oitocentos reais</b>,
    referente ao serviço de pedreiro (levantamento das paredes do térreo), semana de 03/11 a 07/11/2026.</p>
    <p>Pagamento em dinheiro.</p>
    <p class="r">Recife, 07 de novembro de 2026.</p>
    <p class="c" style="margin-top:28px">_____________________________<br>José da Silva Exemplo<br>Pedreiro</p>
  </div>`,
};

const pix = {
  html: `<div class="sheet" style="font-family:Arial,sans-serif;font-size:13px;width:340px">
    <div class="b" style="font-size:16px">Comprovante de transferência</div>
    <div style="color:#666">Pix enviado</div><hr>
    <div style="font-size:22px" class="b">R$ 350,00</div>
    <div>04/11/2026 - 15:21</div><hr>
    <div style="color:#666">Destino</div>
    <div class="b">Transportes Carreto Rápido</div>
    <div>CNPJ ${fmtCnpj(cnpj("554433220001"))}</div>
    <div>Banco Fictício S.A.</div><hr>
    <div style="color:#666">Descrição</div>
    <div>frete entrega telhas</div><hr>
    <div style="color:#666">ID da transação</div>
    <div style="font-size:11px">E00000000202611041521ABCDEFGH123</div>
  </div>`,
};

const orcamento = {
  html: `<div class="sheet" style="font-family:Arial,sans-serif;width:380px">
    <div class="c b" style="font-size:16px">ORÇAMENTO Nº 0458</div>
    <div class="c">Madeireira Pau Firme - Válido por 7 dias</div><hr>
    <table>
      <tr><td>Caibro 5x6 3m</td><td class="r">40 x 18,00</td><td class="r">720,00</td></tr>
      <tr><td>Ripa 1,5x5 3m</td><td class="r">80 x 4,50</td><td class="r">360,00</td></tr>
      <tr><td>Viga 6x12 4m</td><td class="r">6 x 95,00</td><td class="r">570,00</td></tr>
    </table><hr>
    <div class="r b">TOTAL ORÇADO: R$ 1.650,00</div>
    <p style="font-size:11px">Este documento não é comprovante de pagamento. Preços sujeitos a alteração.</p>
  </div>`,
};

const madeireiraItems = [
  { desc: "TELHA CERAMICA COLONIAL", qty: 1200, un: "UN", unit: 165 },
  { desc: "CUMEEIRA CERAMICA", qty: 40, un: "UN", unit: 520 },
];
const madeireiraTotal = madeireiraItems.reduce((t, i) => t + i.qty * i.unit, 0);
const danfe = {
  html: `<div style="font-family:Arial,sans-serif;font-size:11px;padding:24px;width:740px">
    <table style="border:1px solid #000;width:100%"><tr>
      <td style="padding:8px;width:45%"><b style="font-size:14px">MADEIREIRA E CERÂMICA TRÊS PINHEIROS LTDA</b><br>
        Rod. Imaginária, km 12 - Igarassu/PE<br>CNPJ ${fmtCnpj(CNPJ_MADEIREIRA)}</td>
      <td style="padding:8px;text-align:center;border-left:1px solid #000"><b style="font-size:16px">DANFE</b><br>
        Documento Auxiliar da Nota Fiscal Eletrônica<br>1 - SAÍDA<br><b>Nº 000.003.210 SÉRIE 001</b></td>
      <td style="padding:8px;border-left:1px solid #000">CHAVE DE ACESSO<br><b>${blocks(KEY_MADEIREIRA)}</b></td>
    </tr></table>
    <p><b>DATA DA EMISSÃO:</b> 28/10/2026 &nbsp; <b>NATUREZA DA OPERAÇÃO:</b> VENDA</p>
    <p><b>DESTINATÁRIO:</b> CONSUMIDOR FINAL</p>
    <table style="border:1px solid #000;width:100%;border-collapse:collapse" border="1">
      <tr><th>DESCRIÇÃO</th><th>UN</th><th>QTD</th><th>V. UNIT</th><th>V. TOTAL</th></tr>
      ${madeireiraItems
        .map(
          (i) =>
            `<tr><td>${i.desc}</td><td>${i.un}</td><td>${i.qty}</td><td>${brl(i.unit)}</td><td>${brl(i.qty * i.unit)}</td></tr>`,
        )
        .join("")}
    </table>
    <p><b>VALOR TOTAL DA NOTA: R$ ${brl(madeireiraTotal)}</b></p>
    <p><b>FATURA:</b> BOLETO - VENCIMENTO 28/10/2026</p>
  </div>`,
};

const hidraulica = nfce({
  store: "Hidráulica Água Boa Ltda",
  cnpjNum: CNPJ_HIDRAULICA,
  address: "Rua Imaginária, 300 - Casa Amarela - Recife/PE",
  items: [
    {
      code: "4401",
      desc: "TUBO PVC SOLDAVEL 25MM 6M",
      qty: 5,
      un: "BR",
      unit: 2490,
    },
    {
      code: "4402",
      desc: "JOELHO PVC SOLDAVEL 90G 25MM",
      qty: 10,
      un: "UN",
      unit: 120,
    },
    { code: "4403", desc: "ADESIVO PVC 175G", qty: 1, un: "UN", unit: 1890 },
  ],
  payment: "DINHEIRO",
  date: "08/11/2026",
  number: "000007788",
  serie: "001",
  key: KEY_HIDRAULICA,
});

/** Cada comprovante: arquivo, o que a leitura deve achar e a legenda. */
const fixtures = [
  {
    file: "nfce-material.png",
    html: loja.html,
    caption: null,
    expect: {
      is_receipt: true,
      amount_cents: loja.total,
      category: "material",
      spent_on: "2026-11-06",
      payment_method: "pix",
      has_invoice: true,
      supplier_document: CNPJ_LOJA,
      access_key: KEY_LOJA,
      items: 3,
    },
  },
  {
    file: "nfce-eletrica.png",
    html: eletrica.html,
    caption: null,
    expect: {
      is_receipt: true,
      amount_cents: eletrica.total,
      category: "material",
      stage: "Instalações elétricas",
      spent_on: "2026-11-09",
      payment_method: "cartao_debito",
      has_invoice: true,
      supplier_document: CNPJ_ELETRICA,
      access_key: KEY_ELETRICA,
      items: 4,
    },
  },
  {
    file: "nfce-hidraulica.png",
    html: hidraulica.html,
    caption: null,
    expect: {
      is_receipt: true,
      amount_cents: hidraulica.total,
      category: "material",
      stage: "Instalações hidrossanitárias",
      spent_on: "2026-11-08",
      payment_method: "dinheiro",
      has_invoice: true,
      supplier_document: CNPJ_HIDRAULICA,
      access_key: KEY_HIDRAULICA,
      items: 3,
    },
  },
  {
    file: "recibo-pedreiro.png",
    html: recibo.html,
    caption: null,
    expect: {
      is_receipt: true,
      amount_cents: 180000,
      category: "mao_de_obra",
      stage: "Alvenaria",
      spent_on: "2026-11-07",
      payment_method: "dinheiro",
      has_invoice: false,
      items: 0,
    },
  },
  {
    file: "pix-frete.png",
    html: pix.html,
    caption: "frete das telhas",
    expect: {
      is_receipt: true,
      amount_cents: 35000,
      category: "frete",
      spent_on: "2026-11-04",
      payment_method: "pix",
      has_invoice: false,
    },
  },
  {
    file: "orcamento.png",
    html: orcamento.html,
    caption: null,
    expect: { is_receipt: false },
  },
  {
    file: "danfe-telhas.pdf",
    html: danfe.html,
    caption: null,
    expect: {
      is_receipt: true,
      amount_cents: madeireiraTotal,
      category: "material",
      stage: "Cobertura",
      spent_on: "2026-10-28",
      payment_method: "boleto",
      has_invoice: true,
      supplier_document: CNPJ_MADEIREIRA,
      access_key: KEY_MADEIREIRA,
      items: 2,
    },
  },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
for (const fixture of fixtures) {
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>${paper}</style>${fixture.html}`,
  );
  const target = path.join(OUT, fixture.file);
  if (fixture.file.endsWith(".pdf")) {
    await page.pdf({ path: target, format: "A4", printBackground: true });
  } else {
    await page.locator(".sheet").screenshot({ path: target, type: "png" });
  }
  console.log("gerado", target);
}
await browser.close();

await writeFile(
  path.join("tests", "fixtures", "receipts.json"),
  `${JSON.stringify(
    {
      today: "2026-11-10",
      stages: [
        "Projetos e documentação",
        "Serviços preliminares e terreno",
        "Fundação",
        "Estrutura",
        "Alvenaria",
        "Cobertura",
        "Instalações elétricas",
        "Instalações hidrossanitárias",
        "Revestimentos e pisos",
        "Esquadrias (portas e janelas)",
        "Pintura",
        "Louças, metais e acabamentos",
        "Limpeza e entrega",
      ],
      suppliers: [],
      receipts: fixtures.map(({ file, caption, expect }) => ({
        file,
        caption,
        expect,
      })),
    },
    null,
    2,
  )}\n`,
);
console.log("gerado tests/fixtures/receipts.json");
