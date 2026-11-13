// Monta o guia do usuário em PDF a partir das fotos de docs/guia/capturas
// (tiradas por scripts/guia/capturas.spec.ts). Usa o Chromium do Playwright.
//   node scripts/guia/build-pdf.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "docs", "guia");
const SHOTS = path.join(DIR, "capturas");
const OUT = path.join(DIR, "Guia do usuário - Valor da Obra.pdf");

const PHONE_W = 52; // largura da tela no papel, em mm
const SLICE_H = 150; // altura máxima de cada pedaço de tela, em mm
const MAX_COLUMNS = 3; // pedaços lado a lado que cabem na largura da página

/** Quantos pedaços e de que altura, para uma tela de altura `total` (mm). */
function slicing(total, maxH = SLICE_H) {
  let parts = Math.ceil(total / maxH - 0.04);
  if (parts > MAX_COLUMNS) {
    parts = MAX_COLUMNS;
    maxH = Math.ceil(total / MAX_COLUMNS);
  }
  // Último pedaço muito curto: reparte entre os outros.
  if (parts > 1 && total - (parts - 1) * maxH < 20) {
    parts -= 1;
    maxH = Math.ceil(total / parts);
  }
  return { parts, maxH };
}

function pngSize(file) {
  const buf = readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** Uma tela; se for comprida, vira colunas lado a lado. */
function fig(
  name,
  caption,
  { width = PHONE_W, maxH = SLICE_H, crop = [0, 1] } = {},
) {
  const file = path.join(SHOTS, `${name}.png`);
  const { w, h } = pngSize(file);
  // `crop`: só a faixa entre essas frações da altura da tela.
  const full = (h * width) / w;
  const offset = full * crop[0];
  const total = full * (crop[1] - crop[0]);
  const { parts, maxH: sliceMax } = slicing(total, maxH);
  maxH = sliceMax;
  const src = pathToFileURL(file).href;
  const slices = Array.from({ length: parts }, (_, i) => {
    const sliceH = Math.min(maxH, total - i * maxH);
    return `<div class="slice" style="width:${width}mm;height:${sliceH}mm"><img src="${src}" style="width:${width}mm;margin-top:-${offset + i * maxH}mm"></div>`;
  }).join("");
  const note =
    parts > 1
      ? ` <span class="cont">(tela comprida, em ${parts} partes)</span>`
      : "";
  return `<figure>${`<div class="slices">${slices}</div>`}<figcaption>${caption}${note}</figcaption></figure>`;
}

/**
 * Tela e texto. Tela curta: lado a lado. Tela comprida: o texto vem antes e a
 * tela depois, em colunas lado a lado (senão empurraria o texto de página).
 */
function two(name, caption, text) {
  const { w, h } = pngSize(path.join(SHOTS, `${name}.png`));
  const { parts } = slicing((h * PHONE_W) / w);
  if (parts > 1) return `<div class="text">${text}</div>${fig(name, caption)}`;
  return `<div class="two">${fig(name, caption)}<div>${text}</div></div>`;
}

/** Duas ou três telas curtas lado a lado. */
const row = (...figs) => `<div class="row">${figs.join("")}</div>`;

const tip = (text) => `<div class="tip"><strong>Dica</strong> ${text}</div>`;
const note = (text) => `<div class="note">${text}</div>`;
const chat = (lines) =>
  `<div class="chat">${lines
    .map(([who, text]) => `<div class="msg ${who}">${text}</div>`)
    .join("")}</div>`;

const icon = pathToFileURL(path.join(ROOT, "public", "brand", "icon.svg")).href;

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  :root { --navy:#132A42; --gold:#F5AD02; --concrete:#F2F4F7; --graphite:#4E5D72; }
  * { box-sizing: border-box; }
  body { font-family: Archivo, Arial, sans-serif; color: var(--navy); font-size: 10.5pt; line-height: 1.5; margin: 0; }
  h1, h2, h3 { font-stretch: 125%; font-weight: 800; line-height: 1.15; }
  h2 { font-size: 20pt; margin: 0 0 4mm; padding-top: 2mm; break-before: page; }
  h2 .n { color: var(--gold); margin-right: 3mm; }
  h3 { font-size: 13pt; margin: 6mm 0 2mm; break-after: avoid; }
  p, li { color: #1d2c3d; }
  ul, ol { padding-left: 6mm; }
  .lead { font-size: 11.5pt; color: var(--graphite); }
  figure { margin: 4mm 0; break-inside: avoid; }
  .slices { display: flex; gap: 4mm; flex-wrap: wrap; }
  .slice { overflow: hidden; border-radius: 3mm; border: 0.3mm solid #cfd6df; background: var(--concrete); break-inside: avoid; }
  .slice img { display: block; }
  figcaption { font-size: 9pt; color: var(--graphite); margin-top: 1.5mm; }
  .cont { color: #8a96a6; }
  .row { display: flex; gap: 6mm; align-items: flex-start; flex-wrap: wrap; }
  .row figure { margin: 2mm 0; }
  .tip, .note { border-radius: 2mm; padding: 3mm 4mm; margin: 4mm 0; break-inside: avoid; }
  .tip { background: #FFF6DC; border-left: 1.2mm solid var(--gold); }
  .tip strong { margin-right: 1.5mm; }
  .note { background: var(--concrete); border-left: 1.2mm solid var(--navy); }
  table { border-collapse: collapse; width: 100%; margin: 3mm 0; font-size: 9.5pt; break-inside: avoid; }
  th, td { text-align: left; padding: 1.6mm 2.5mm; border-bottom: 0.3mm solid #dfe4ea; vertical-align: top; }
  th { background: var(--navy); color: #fff; font-weight: 700; }
  .chat { background: #ECE5DD; border-radius: 3mm; padding: 3mm; margin: 3mm 0; display: flex; flex-direction: column; gap: 2mm; break-inside: avoid; max-width: 120mm; }
  .msg { padding: 2mm 3mm; border-radius: 2.5mm; max-width: 85%; font-size: 9.5pt; white-space: pre-line; }
  .msg.eu { background: #DCF8C6; align-self: flex-end; }
  .msg.bot { background: #fff; align-self: flex-start; }
  .msg.btn { background: #fff; align-self: flex-start; color: #0b7bb5; text-align: center; min-width: 40mm; }
  code, kbd { font-family: Consolas, monospace; background: var(--concrete); padding: 0.3mm 1.2mm; border-radius: 1mm; font-size: 9.5pt; }
  .cover { height: 263mm; background: var(--navy); color: #fff; border-radius: 4mm; padding: 22mm 18mm; display: flex; flex-direction: column; justify-content: space-between;
    background-image: linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px); background-size: 8mm 8mm; }
  .cover h1 { font-size: 34pt; margin: 8mm 0 4mm; color: #fff; }
  .cover .sub { font-size: 14pt; color: rgba(255,255,255,.85); }
  .cover .brand { display: flex; align-items: center; gap: 4mm; font-stretch: 125%; font-weight: 800; font-size: 18pt; }
  .cover .brand img { width: 16mm; height: 16mm; }
  .cover .gold { color: var(--gold); }
  .toc { columns: 2; column-gap: 10mm; font-size: 10.5pt; }
  .toc li { break-inside: avoid; margin-bottom: 1mm; }
  .two { display: grid; grid-template-columns: ${PHONE_W}mm 1fr; gap: 7mm; align-items: start; }
  .two > div > :first-child { margin-top: 0; }
</style></head><body>

<section class="cover">
  <div class="brand"><img src="${icon}">Valor da Obra</div>
  <div>
    <div class="gold" style="font-weight:700;letter-spacing:.5mm">GUIA DO USUÁRIO</div>
    <h1>Cada real da sua casa na ponta do lápis</h1>
    <p class="sub">Como usar o app do cadastro ao fim da obra: lançar gastos pelo celular ou pelo WhatsApp, acompanhar o previsto x realizado de cada etapa, contas a pagar, equipe e relatórios.</p>
  </div>
  <div style="font-size:9.5pt;color:rgba(255,255,255,.7)">valordaobra.com.br · Versão de novembro de 2026 · Os exemplos usam uma obra fictícia (“Casa da Maria”).</div>
</section>

<h2 style="break-before:page">Sumário</h2>
<ol class="toc">
  <li>O que é o Valor da Obra</li>
  <li>Criar a conta e entrar</li>
  <li>Cadastrar a primeira obra</li>
  <li>Como o app é organizado</li>
  <li>Lançar um gasto pelo app</li>
  <li>Lista de gastos, busca e planilha</li>
  <li>O painel da obra</li>
  <li>Etapas, orçamento e progresso</li>
  <li>Contas a pagar e parcelas</li>
  <li>Relatório em PDF</li>
  <li>WhatsApp: conectar o número</li>
  <li>WhatsApp: lançar por texto, foto e áudio</li>
  <li>WhatsApp: comandos, perguntas e avisos</li>
  <li>Equipe e convites</li>
  <li>Dados da obra e arquivar</li>
  <li>Plano e uso</li>
  <li>Seus dados: planilha completa e excluir conta</li>
  <li>Instalar no celular e dúvidas frequentes</li>
</ol>

<h2><span class="n">1</span>O que é o Valor da Obra</h2>
<p class="lead">Um app para quem está construindo ou reformando controlar cada real gasto na obra, sem planilha.</p>
<p>Você lança os gastos (pelo app ou mandando uma mensagem no WhatsApp) e o app soma tudo por <strong>etapa</strong> da obra (fundação, alvenaria, cobertura…), por <strong>categoria</strong> (material, mão de obra, frete…) e por <strong>mês</strong>. Se você definir quanto pretende gastar em cada etapa, ele compara o <strong>previsto com o realizado</strong> e avisa quando uma etapa está perto de estourar, a tempo de corrigir o rumo.</p>
<h3>Para quem é</h3>
<ul>
  <li><strong>Quem está construindo a própria casa</strong>: plano Pessoal, uma obra, a família junto.</li>
  <li><strong>Pequeno construtor ou empreiteiro</strong>: plano Profissional, várias obras ao mesmo tempo, com mestre de obras e clientes acompanhando.</li>
</ul>
<h3>Três jeitos de lançar um gasto</h3>
<table>
  <tr><th>Jeito</th><th>Quando usar</th><th>Exemplo</th></tr>
  <tr><td>Pelo app</td><td>Quando quer preencher com calma, anexar a foto ou informar quantidade</td><td>Tecla dourada “Lançar gasto”</td></tr>
  <tr><td>Mensagem no WhatsApp</td><td>No canteiro, na loja, na hora de pagar</td><td><code>300 pedreiro</code></td></tr>
  <tr><td>Foto ou áudio no WhatsApp</td><td>Com o cupom na mão, ou com as mãos ocupadas</td><td>Foto do cupom da loja</td></tr>
</table>
${note("<strong>Regra de ouro:</strong> nada que a inteligência artificial lê é gravado sem você confirmar. No WhatsApp, o gasto só vale depois do toque em <em>Confirmar</em> (ou na etapa).")}

<h2><span class="n">2</span>Criar a conta e entrar</h2>
${two(
  "04-entrar",
  "Tela de entrada",
  `
    <p>Acesse <strong>valordaobra.com.br</strong> e toque em <strong>Começar grátis</strong> ou <strong>Entrar</strong>. Não existe senha para decorar:</p>
    <ul>
      <li><strong>Entrar com Google</strong>: um toque, se você usa conta Google no celular.</li>
      <li><strong>Com e-mail</strong>: digite seu e-mail, receba um <strong>código de acesso</strong> e digite-o na tela (ou toque no link do e-mail).</li>
    </ul>
    <p>A conta nova começa com <strong>14 dias grátis</strong>, sem cartão de crédito.</p>
    ${tip("O primeiro acesso cria a sua conta automaticamente. Nas próximas vezes, o mesmo e-mail ou Google entra direto nas suas obras.")}
`,
)}
<h3>Primeiro acesso</h3>
${two(
  "05-primeiro-acesso",
  "Primeiro acesso: seu nome e o nome da conta",
  `
    <p>Na primeira vez, o app pergunta duas coisas:</p>
    <ul>
      <li><strong>Seu nome</strong>: aparece para as pessoas que você convidar.</li>
      <li><strong>Nome da conta</strong>: pode ser o seu nome (“Maria Souza”) ou o da sua empresa (“Souza Construções”). É o nome de quem “paga” o app e dono das obras.</li>
    </ul>
    <p>Depois de <strong>Continuar</strong>, o app leva direto para o cadastro da primeira obra.</p>
`,
)}

<h2><span class="n">3</span>Cadastrar a primeira obra</h2>
${two(
  "06-nova-obra",
  "Nova obra",
  `
    <p>Só o <strong>nome da obra</strong> é obrigatório. O resto pode ser preenchido depois na aba <strong>Obra</strong>:</p>
    <ul>
      <li><strong>Cidade e UF</strong>.</li>
      <li><strong>Área construída (m²)</strong>: só a área coberta da casa, sem o terreno. Serve para o <em>custo por m²</em> e para a estimativa do orçamento.</li>
      <li><strong>Padrão de acabamento</strong>: econômico, normal ou alto.</li>
      <li><strong>Início</strong>, <strong>situação</strong> (planejamento, em andamento, pausada, concluída) e <strong>endereço</strong>.</li>
    </ul>
    <h3>As etapas já vêm prontas</h3>
    <p>Toda obra nasce com 13 etapas padrão, que você pode renomear, reordenar, apagar ou completar (veja o capítulo 8):</p>
    <p style="font-size:9.5pt">Projetos e documentação · Serviços preliminares e terreno · Fundação · Estrutura · Alvenaria · Cobertura · Instalações elétricas · Instalações hidrossanitárias · Revestimentos e pisos · Esquadrias (portas e janelas) · Pintura · Louças, metais e acabamentos · Limpeza e entrega</p>
`,
)}

<h2><span class="n">4</span>Como o app é organizado</h2>
${two(
  "07-painel-vazio",
  "Obra recém-criada, ainda sem gastos",
  `
    <h3>A barra de baixo (sempre visível)</h3>
    <table>
      <tr><th>Botão</th><th>O que abre</th></tr>
      <tr><td>Obras</td><td>Lista das suas obras</td></tr>
      <tr><td>Gastos</td><td>Os gastos da obra</td></tr>
      <tr><td><strong>Lançar gasto</strong> (dourado)</td><td>O formulário curto de gasto. É o botão principal do app.</td></tr>
      <tr><td>Contas</td><td>Contas a pagar</td></tr>
      <tr><td>Mais</td><td>Configurações: equipe, WhatsApp, plano, seus dados</td></tr>
    </table>
    <h3>As abas de cada obra</h3>
    <ul>
      <li><strong>Painel</strong>: o resumo da obra (capítulo 7).</li>
      <li><strong>Gastos</strong>: a lista com busca e filtros (capítulo 6).</li>
      <li><strong>Etapas</strong>: previsto x realizado, orçamento e progresso (capítulo 8).</li>
      <li><strong>Contas</strong>: contas a pagar e parcelas (capítulo 9).</li>
      <li><strong>Obra</strong>: dados da obra, pessoas e arquivar (capítulo 15).</li>
    </ul>
    ${tip("O dourado no app é reservado ao dinheiro: o botão Lançar gasto e o que já foi gasto nos gráficos. Verde, amarelo e vermelho são os avisos do orçamento.")}
`,
)}

<h2><span class="n">5</span>Lançar um gasto pelo app</h2>
${two(
  "09-lancar-gasto",
  "Formulário curto: valor, descrição e etapa",
  `
    <p>Toque na tecla dourada <strong>Lançar gasto</strong>. O formulário foi feito para levar menos de 10 segundos:</p>
    <ol>
      <li><strong>Valor</strong>: o teclado numérico abre sozinho. Digite só os números: <code>30000</code> vira <strong>R$ 300,00</strong>.</li>
      <li><strong>Descrição</strong> (opcional): “Diária do eletricista”. Se deixar em branco, o app usa o nome da categoria.</li>
      <li><strong>Etapa</strong> (opcional): em qual etapa o gasto entra. Se não souber agora, deixe “Sem etapa (classificar depois)”: ele aparece no painel em <em>Para classificar</em>.</li>
      <li>Toque em <strong>Salvar gasto</strong>. Pronto, o painel já está atualizado.</li>
    </ol>
`,
)}
<h3>Mais detalhes (opcional)</h3>
${two(
  "10-mais-detalhes",
  "“Mais detalhes” aberto",
  `
    <p>Toque em <strong>Mais detalhes</strong> para informar:</p>
    <ul>
      <li><strong>Categoria</strong>: Material, Mão de obra, Serviço terceirizado, Aluguel de equipamentos, Frete, Taxas e documentação, Terreno ou Outros.</li>
      <li><strong>Data</strong>: vem com a data de hoje.</li>
      <li><strong>Fornecedor ou loja</strong>: digite o nome. Se for novo, o app cadastra sozinho; nas próximas vezes ele aparece como sugestão.</li>
      <li><strong>Forma de pagamento</strong>: Pix, dinheiro, cartão de crédito ou débito, boleto, transferência.</li>
      <li><strong>Tem nota fiscal</strong>: para depois filtrar o que tem e o que não tem nota.</li>
      <li><strong>Quantidade × valor unitário</strong>: por exemplo <em>20 sacos × R$ 39,00</em>; o app calcula o total de R$ 780,00.</li>
      <li><strong>Foto do comprovante</strong>: foto do cupom ou nota, ou um PDF. A foto é reduzida no próprio celular antes de subir, para gastar pouca internet.</li>
    </ul>
    ${note("<strong>Terreno é separado.</strong> Gastos na categoria <em>Terreno</em> (compra do lote, ITBI, escritura) entram no total investido, mas ficam fora do custo da construção, do custo por m² e do previsto x realizado das etapas, para não distorcer esses números.")}
`,
)}

<h2><span class="n">6</span>Lista de gastos, busca e planilha</h2>
${two(
  "11-gastos",
  "Aba Gastos",
  `
    <p>A aba <strong>Gastos</strong> mostra todos os gastos da obra, do mais novo para o mais antigo, com o total no topo.</p>
    <h3>Buscar e filtrar</h3>
    <ul>
      <li><strong>Busca</strong>: digite parte da descrição ou do fornecedor (“cimento”, “pedreiro”, “Casa do Construtor”) e toque em <strong>Filtrar</strong>.</li>
      <li><strong>Filtros</strong>: período, etapa, categoria, fornecedor e com ou sem nota fiscal. O total do topo passa a somar só o que está filtrado.</li>
    </ul>
    <h3>Ver, corrigir e excluir</h3>
    <p>Toque num gasto para abrir os detalhes. Lá você corrige os campos ou exclui o gasto. O gasto excluído some dos totais, mas fica guardado no histórico de alterações.</p>
    <h3>Planilha</h3>
    <p>No fim da lista: <strong>Baixar planilha (Excel)</strong> ou <strong>Baixar em CSV</strong>. A planilha respeita os filtros: filtre “Fundação” e baixe só os gastos da fundação, por exemplo.</p>
`,
)}
${two(
  "12-gasto-detalhe",
  "Detalhe de um gasto (veio da foto de um cupom pelo WhatsApp)",
  `
    <h3>Detalhe do gasto</h3>
    <p>Mostra tudo o que foi informado: valor, etapa, categoria, data, fornecedor, pagamento, nota fiscal, quantidade e a foto do comprovante (que só você e sua equipe conseguem abrir).</p>
    <p>Gastos lançados pelo WhatsApp aparecem aqui do mesmo jeito, prontos para corrigir se algo veio errado.</p>
`,
)}

<h2><span class="n">7</span>O painel da obra</h2>
<p class="lead">O painel responde, numa tela só: quanto já foi, para onde foi e o que precisa de atenção.</p>
${fig("08-painel", "Painel da obra “Casa da Maria”")}
<table>
  <tr><th>Bloco</th><th>O que mostra</th></tr>
  <tr><td>Gasto na construção</td><td>Total gasto na construção, custo por m² construído, terreno à parte e total investido (construção + terreno).</td></tr>
  <tr><td>Atenção</td><td>Etapas perto do limite (amarelo) ou acima do previsto (vermelho), e etapas em que o gasto está muito à frente do progresso.</td></tr>
  <tr><td>Contas a pagar</td><td>Total a pagar, contas atrasadas em vermelho e as próximas a vencer.</td></tr>
  <tr><td>Para classificar</td><td>Gastos sem etapa. Toque em cada um para escolher a etapa.</td></tr>
  <tr><td>Por etapa</td><td>Previsto, gasto, a pagar e sobra de cada etapa, com a barra de previsto x realizado e o progresso informado.</td></tr>
  <tr><td>Por categoria e por mês</td><td>Para onde o dinheiro foi e em que ritmo.</td></tr>
  <tr><td>Últimos gastos</td><td>Os lançamentos mais recentes, com atalho para a lista toda e para o relatório em PDF.</td></tr>
</table>

<h2><span class="n">8</span>Etapas, orçamento e progresso</h2>
${two(
  "13-etapas",
  "Aba Etapas: previsto x realizado",
  `
    <p>A aba <strong>Etapas</strong> compara, para cada etapa, quanto estava previsto com quanto já foi gasto e quanto ainda está a pagar.</p>
    <h3>O que as cores querem dizer</h3>
    <table>
      <tr><th>Aviso</th><th>Quando aparece</th></tr>
      <tr><td><span style="color:#15803d;font-weight:700">Dentro do previsto</span></td><td>Gasto + contas a pagar abaixo de 80% do previsto.</td></tr>
      <tr><td><span style="color:#b45309;font-weight:700">Perto do limite</span></td><td>Gasto + contas a pagar passou de 80% do previsto.</td></tr>
      <tr><td><span style="color:#b91c1c;font-weight:700">Acima do previsto</span></td><td>Passou de 100%.</td></tr>
      <tr><td>Gasto à frente da obra</td><td>O percentual gasto passou mais de 20 pontos do quanto a etapa está pronta. Ex.: 70% do dinheiro gasto e só 40% pronta.</td></tr>
    </table>
    <p>No exemplo, <em>Projetos e documentação</em> já usou 91% do previsto (R$ 9.150 de R$ 10.080) e por isso está “Perto do limite”.</p>
`,
)}
<h3>Orçamento: quanto prever em cada etapa</h3>
${two(
  "14-orcamento",
  "Orçamento com a estimativa por m²",
  `
    <p>Em <strong>Etapas › Orçamento</strong> há dois caminhos:</p>
    <ol>
      <li><strong>Estimativa</strong>: informe a área construída e o <strong>custo por m²</strong> que você espera (por exemplo, o CUB do seu estado ou o valor que o seu construtor passou). Toque em <strong>Preencher as etapas</strong> e o app divide o total entre as etapas por percentuais de referência.</li>
      <li><strong>Manual</strong>: digite o previsto de cada etapa (o orçamento do pedreiro, o valor do projeto…).</li>
    </ol>
    <p>Pode misturar: comece pela estimativa e ajuste as etapas que você já sabe. O total da obra é a soma das etapas. Toque em <strong>Salvar orçamento</strong>.</p>
    ${note("Os percentuais por etapa são uma referência aproximada para começar, não um dado técnico. Ajuste à sua obra.")}
    <p style="font-size:9.5pt">Exemplo: 120 m² × R$ 2.800/m² = R$ 336.000. Fundação (8%) = R$ 26.880; Revestimentos e pisos (16%) = R$ 53.760.</p>
`,
)}
<h3>Progresso e organizar etapas</h3>
${row(fig("15-progresso", "Progresso de cada etapa"), fig("16-organizar", "Organizar etapas"))}
<ul>
  <li><strong>Progresso</strong>: diga quanto cada etapa está pronta (0 a 100%). É isso que permite o aviso de “gasto à frente da obra”.</li>
  <li><strong>Organizar etapas</strong>: renomeie (“Fundação” → “Fundação e baldrame”), mude a ordem, remova o que sua obra não tem ou acrescente etapas novas (“Piscina”, “Muro”).</li>
</ul>

<h2><span class="n">9</span>Contas a pagar e parcelas</h2>
${two(
  "17-contas",
  "Aba Contas",
  `
    <p>Cadastre o que ainda vai vencer: o boleto da madeira, as parcelas da vidraçaria, o restante do pedreiro. Assim o app mostra o que já está <strong>comprometido</strong> em cada etapa, e não só o que já saiu do bolso.</p>
    <p>A aba separa as contas em <strong>atrasadas</strong>, <strong>a vencer</strong>, <strong>pagas</strong> e <strong>canceladas</strong>, com o total a pagar no topo.</p>
    ${tip("No botão Contas da barra de baixo você vê as contas de todas as obras juntas.")}
`,
)}
${row(fig("18-nova-conta", "Nova conta em 3 parcelas"), fig("19-pagar-conta", "Marcar uma parcela como paga"))}
<h3>Nova conta</h3>
<ul>
  <li>Informe <strong>do que é a conta</strong>, o <strong>valor total</strong>, o <strong>vencimento</strong>, a etapa e a categoria.</li>
  <li>Em <strong>Parcelas</strong>, escolha quantas: o app divide o valor e cria uma parcela por mês. Ex.: R$ 4.500,00 em 3× = 3 parcelas de R$ 1.500,00 (se sobrar centavo, ele vai na 1ª).</li>
</ul>
<h3>Marcar como paga</h3>
<p>Abra a conta e toque em <strong>Confirmar pagamento</strong>. O pagamento vira um <strong>gasto da obra</strong> automaticamente, na etapa certa. Se pagou com juros ou desconto, mude o valor antes; mude também a data e a forma de pagamento se precisar.</p>
<p>Também dá para <strong>editar</strong> uma parcela em aberto ou <strong>cancelar</strong> uma conta que não vale mais. Se o gasto de um pagamento for excluído, a conta volta a ficar em aberto.</p>

<h2><span class="n">10</span>Relatório em PDF</h2>
${two(
  "20-relatorio",
  "Relatório da obra",
  `
    <p>No painel ou na aba Gastos, toque em <strong>Relatório em PDF</strong>. O relatório traz:</p>
    <ul>
      <li>Dados da obra e resumo: construção, custo por m², terreno, total investido, contas em aberto e atrasadas.</li>
      <li>Previsto x realizado por etapa (ou só o gasto, se não houver orçamento).</li>
      <li>Gastos por categoria e por mês, e contas em aberto.</li>
      <li>Opcional: a lista de gastos (até 500; para mais, use a planilha).</li>
    </ul>
    <p>Toque em <strong>Salvar em PDF</strong>: o celular abre a tela de impressão; escolha “Salvar como PDF”. Bom para mandar ao cliente, ao banco do financiamento ou ao sócio.</p>
`,
)}

<h2><span class="n">11</span>WhatsApp: conectar o número</h2>
${row(fig("27-whatsapp", "Mais › WhatsApp"), fig("28-whatsapp-codigo", "Código de 6 dígitos para conectar"))}
<ol>
  <li>Toque em <strong>Mais › WhatsApp › Conectar WhatsApp</strong>.</li>
  <li>O app mostra um <strong>código de 6 dígitos</strong> (vale por 15 minutos) e o botão <strong>Abrir o WhatsApp</strong>, que já abre a conversa com o bot com a mensagem <code>VINCULAR 123456</code> pronta. É só enviar.</li>
  <li>Volte ao app e toque em <strong>Já enviei</strong>. Pronto: o número está conectado.</li>
</ol>
<p>Se o WhatsApp não abrir sozinho, mande a mensagem <code>VINCULAR</code> seguida do código para o número do bot que aparece na tela. Para trocar de celular, gere um código novo pelo número novo. Para parar de usar, toque em <strong>Desconectar</strong>.</p>
${note("Mande a mensagem do celular que você vai usar na obra. Cada número fica ligado a uma pessoa só.")}

<h2><span class="n">12</span>WhatsApp: lançar por texto, foto e áudio</h2>
${fig("02-conversa", "Exemplo de conversa com o bot", { width: 70, crop: [0.485, 0.955] })}
<h3>Por texto</h3>
<p>Mande o valor e o que foi, do seu jeito. O bot entende jeitos comuns de falar de dinheiro e de obra:</p>
<table>
  <tr><th>Você manda</th><th>O bot entende</th></tr>
  <tr><td><code>300 pedreiro</code></td><td>R$ 300,00 · Mão de obra · hoje</td></tr>
  <tr><td><code>2 sacos de cimento 78 reais na loja do zé</code></td><td>R$ 78,00 · Material · fornecedor “Loja do Zé”</td></tr>
  <tr><td><code>ontem 450 de areia no pix</code></td><td>R$ 450,00 · Material · data de ontem · Pix</td></tr>
  <tr><td><code>1,5 mil empreita do telhado</code></td><td>R$ 1.500,00 · Mão de obra</td></tr>
  <tr><td><code>trezentos conto diária do servente</code></td><td>R$ 300,00 · Mão de obra</td></tr>
  <tr><td><code>milheiro de tijolo 850 com nota</code></td><td>R$ 850,00 · Material · com nota fiscal</td></tr>
</table>
<p>O bot responde com um resumo e os botões:</p>
${chat([
  ["eu", "2 sacos de cimento 78 na loja do zé"],
  ["bot", "R$ 78,00 · Material · Fundação · Loja do Zé · hoje · sem nota"],
  ["btn", "Confirmar"],
  ["btn", "Editar"],
  ["btn", "Cancelar"],
])}
<ul>
  <li><strong>Confirmar</strong>: o gasto entra na obra.</li>
  <li><strong>Editar</strong>: mude valor, etapa, categoria, data, descrição, fornecedor, forma de pagamento, nota fiscal ou até a obra.</li>
  <li><strong>Cancelar</strong>: nada é gravado.</li>
</ul>
<p>Se o bot não souber a etapa, ele mostra a lista de etapas: <strong>escolher a etapa já confirma</strong> o gasto. Assim, “300 pedreiro” vira um gasto lançado em 2 toques. Se faltar o valor, ele pergunta só o valor.</p>
${note("Um gasto que fica sem confirmação por mais de 24 horas é cancelado sozinho.")}
<h3>Por foto do cupom ou nota</h3>
<p>Mande a <strong>foto</strong> (ou o <strong>PDF</strong>) do cupom, da nota fiscal, do recibo ou do comprovante do Pix. O bot lê o total, a loja, o CNPJ, a data, a forma de pagamento e os <strong>itens</strong>, e guarda a foto junto com o gasto.</p>
<p>Se os itens da nota forem de etapas diferentes (cimento para a fundação, fio para a elétrica), o bot propõe <strong>dividir</strong> a nota em um gasto por etapa, com os botões <em>Dividir e lançar</em>, <em>Ajustar divisão</em> e <em>Não dividir</em>.</p>
${tip("Foto nítida, com o cupom inteiro e boa luz, é lida melhor. ")}
<h3>Por áudio</h3>
<p>Mande um áudio falando o gasto, como falaria com alguém: <em>“paguei quatrocentos e cinquenta de areia ontem no pix”</em>. O bot responde começando com 🎤 e o que entendeu, para você conferir antes de confirmar. Fale o valor e o que foi; barulho alto de máquina atrapalha.</p>

<h2><span class="n">13</span>WhatsApp: comandos, perguntas e avisos</h2>
<h3>Comandos</h3>
<table>
  <tr><th>Mande</th><th>O que acontece</th></tr>
  <tr><td><code>ajuda</code></td><td>O bot explica o que faz, em poucas linhas.</td></tr>
  <tr><td><code>obras</code></td><td>Lista suas obras e deixa trocar a <strong>obra ativa</strong> (a que recebe os gastos).</td></tr>
  <tr><td><code>resumo</code></td><td>Total gasto na construção, previsto, contas a pagar, terreno, as 5 etapas com mais gasto e os gastos sem etapa.</td></tr>
  <tr><td><code>desfazer</code></td><td>Cancela o último gasto que você confirmou pelo WhatsApp nos últimos 10 minutos.</td></tr>
</table>
<h3>Perguntas sobre a obra</h3>
<p>Pergunte do seu jeito, por texto ou áudio:</p>
${chat([
  ["eu", "quanto gastei com cimento em outubro?"],
  ["eu", "quanto já foi na alvenaria?"],
  ["eu", "tem conta atrasada?"],
  ["eu", "quanto paguei pro seu antônio?"],
  ["eu", "como está o orçamento?"],
])}
<p>A inteligência artificial só entende a pergunta; os números da resposta vêm direto dos seus lançamentos confirmados, nunca são inventados.</p>
<h3>Avisos automáticos</h3>
<ul>
  <li><strong>Alerta de orçamento</strong>: quando uma etapa passa de 80% ou de 100% do previsto (contando as contas a pagar).</li>
  <li><strong>Resumo da semana</strong>: toda segunda-feira, o que foi gasto na semana anterior e as contas para olhar.</li>
</ul>
<p>Os avisos vão para o dono e os administradores com WhatsApp conectado. Dá para ligar ou desligar cada um em <strong>Mais › WhatsApp</strong>.</p>
${note("<strong>Quem só acompanha</strong> uma obra (ex.: o cliente) também pode conectar o WhatsApp: para essa pessoa, o bot responde perguntas e resumos, mas não lança gastos.")}

<h2><span class="n">14</span>Equipe e convites</h2>
${row(fig("24-equipe", "Mais › Equipe"), fig("25-convidar", "Convidar pessoa"))}
<p>Chame quem participa da obra. Cada pessoa entra com o próprio e-mail ou Google.</p>
<table>
  <tr><th>Acesso</th><th>Para quem</th><th>O que pode</th></tr>
  <tr><td>Só uma obra · <strong>Pode lançar</strong></td><td>Mestre de obras, cônjuge</td><td>Lança e edita gastos, contas e etapas daquela obra.</td></tr>
  <tr><td>Só uma obra · <strong>Só acompanha</strong></td><td>Cliente, familiar</td><td>Vê gastos e painel daquela obra, sem mudar nada.</td></tr>
  <tr><td><strong>Todas as obras</strong> (administrador)</td><td>Sócio, quem cuida das obras com você</td><td>Vê e edita todas as obras e cuida da equipe.</td></tr>
</table>
<ol>
  <li>Em <strong>Mais › Equipe › Convidar</strong>, escolha o acesso, a obra e o que a pessoa pode fazer. O “nome para lembrar” é opcional e só você vê.</li>
  <li>Toque em <strong>Gerar link de convite</strong>. O link aparece uma vez: <strong>copie</strong> ou <strong>mande pelo WhatsApp</strong>.</li>
  <li>A pessoa abre o link, entra e informa só o nome. Já cai na obra.</li>
</ol>
<p>O link vale por 7 dias e serve para uma pessoa só. Convites ainda não usados aparecem na tela da equipe e podem ser cancelados.</p>
${two(
  "26-pessoa",
  "Uma pessoa da equipe",
  `
    <h3>Mudar o acesso ou tirar da equipe</h3>
    <p>Toque no nome da pessoa para mudar o papel, liberar ou tirar o acesso a cada obra, ou <strong>tirar da equipe</strong>. Ela deixa de ver as obras na hora; os gastos que lançou continuam na obra.</p>
    ${tip("Na aba Obra de cada obra, “Pessoas desta obra” mostra quem vê ou lança naquela obra, com atalho para convidar.")}
`,
)}

<h2><span class="n">15</span>Dados da obra e arquivar</h2>
${two(
  "21-config-obra",
  "Aba Obra",
  `
    <p>Na aba <strong>Obra</strong> você corrige os dados da obra a qualquer momento (nome, cidade, área, padrão, início, situação, endereço) e vê quem participa dela.</p>
    <h3>Arquivar</h3>
    <p>Terminou a obra ou ela parou de vez? <strong>Arquivar obra</strong> tira a obra da lista e ela para de contar no limite do plano. Os gastos continuam guardados.</p>
    <p>As obras arquivadas ficam em <strong>Obras › Arquivadas</strong>, com o botão para <strong>reativar</strong>.</p>
`,
)}
${two(
  "22-obras",
  "Lista de obras",
  `
    <h3>Várias obras</h3>
    <p>No plano Profissional você tem várias obras ativas ao mesmo tempo. Toque numa obra da lista para abrir. O botão <strong>Nova obra</strong> fica no topo.</p>
    <p>Se você participa de mais de uma conta (a sua e a de um construtor que convidou você, por exemplo), troque de conta em <strong>Mais › Configurações</strong>.</p>
`,
)}

<h2><span class="n">16</span>Plano e uso</h2>
${two(
  "29-plano",
  "Mais › Plano e uso",
  `
    <p>Em <strong>Mais › Plano e uso</strong> (só para o dono e administradores) você vê o plano, o preço e quanto já usou no mês.</p>
    <table>
      <tr><th></th><th>Pessoal</th><th>Profissional</th></tr>
      <tr><td>Preço</td><td>R$ 19,90/mês</td><td>R$ 79,90/mês</td></tr>
      <tr><td>Obras ativas</td><td>1</td><td>até 10</td></tr>
      <tr><td>Pessoas com acesso</td><td>até 3</td><td>até 10</td></tr>
      <tr><td>Lançamentos por WhatsApp/mês</td><td>300</td><td>3.000</td></tr>
      <tr><td>Foto, áudio e perguntas no bot</td><td>sim</td><td>sim</td></tr>
    </table>
    <p>Toda conta começa com <strong>14 dias grátis</strong>. Para continuar, toque em <strong>Assinar um plano</strong> e pague por Pix, boleto ou cartão.</p>
    ${note("<strong>Chegou no limite?</strong> Você continua vendo, editando, exportando e excluindo tudo. Só não cria além do limite (uma obra a mais, por exemplo) até mudar de plano ou arquivar uma obra.")}
    <p style="font-size:9.5pt">Pessoas com acesso contam cada pessoa uma vez, mais os convites ainda não usados.</p>
`,
)}

<h2><span class="n">17</span>Seus dados: planilha completa e excluir conta</h2>
${two(
  "30-meus-dados",
  "Mais › Seus dados",
  `
    <h3>Baixar todos os seus dados</h3>
    <p>Gera uma planilha com tudo o que você vê em todas as contas de que participa: obras, etapas, gastos, contas, fornecedores. Bom para guardar uma cópia ou levar para o contador.</p>
    <h3>Excluir a conta</h3>
    <p>Para apagar a sua conta, digite <strong>EXCLUIR</strong> e confirme. São apagados os seus dados pessoais, as contas de que você é o único dono (com obras, gastos e fotos de comprovantes) e o histórico do WhatsApp. Não dá para desfazer.</p>
    ${tip("Antes de excluir, baixe a planilha. Se você só foi convidado para a obra de outra pessoa, a obra dela continua existindo.")}
`,
)}

<h2><span class="n">18</span>Instalar no celular e dúvidas frequentes</h2>
<h3>Instalar como app</h3>
<p>O Valor da Obra funciona no navegador, mas fica melhor instalado na tela inicial, como um app:</p>
<ul>
  <li><strong>Android (Chrome)</strong>: abra valordaobra.com.br, toque nos três pontinhos e em <strong>Instalar app</strong> (ou “Adicionar à tela inicial”).</li>
  <li><strong>iPhone (Safari)</strong>: abra o site, toque em <strong>Compartilhar</strong> e em <strong>Adicionar à Tela de Início</strong>.</li>
</ul>
<h3>Dúvidas frequentes</h3>
<p><strong>A inteligência artificial grava gastos sozinha?</strong><br>Não. Ela só lê a mensagem, a foto ou o áudio e propõe. O gasto só vale depois que você confirma.</p>
<p><strong>Quem consegue ver os dados da minha obra?</strong><br>Só você e quem você convidou. As fotos dos comprovantes ficam guardadas de forma privada.</p>
<p><strong>Serve para reforma?</strong><br>Serve. Renomeie, remova ou crie etapas para a sua reforma (“Demolição”, “Cozinha”, “Banheiro”).</p>
<p><strong>Os valores de orçamento são exatos?</strong><br>Não. A estimativa por m² e os percentuais por etapa são uma referência para começar. O valor certo é o que você informar.</p>
<p><strong>Lancei errado pelo WhatsApp. E agora?</strong><br>Se foi agora, mande <code>desfazer</code> (até 10 minutos). Depois disso, abra o gasto no app e corrija ou exclua.</p>
<p><strong>Paguei uma conta. Preciso lançar o gasto também?</strong><br>Não. Marque a conta como paga: o gasto é criado sozinho.</p>
<p><strong>Comprei o terreno. Lanço onde?</strong><br>Na categoria <em>Terreno</em>. Ele aparece no total investido, mas fica fora do custo da construção e do custo por m².</p>
<p><strong>Precisa de ajuda?</strong><br>Escreva para <strong>contato@valordaobra.com.br</strong>.</p>

</body></html>`;

const htmlFile = path.join(DIR, "guia.html");
writeFileSync(htmlFile, html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({
  path: OUT,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate:
    '<div style="width:100%;font-size:8px;color:#4E5D72;padding:0 15mm;display:flex;justify-content:space-between;font-family:Arial"><span>Valor da Obra · Guia do usuário</span><span class="pageNumber"></span></div>',
});
await browser.close();
console.log(OUT);
