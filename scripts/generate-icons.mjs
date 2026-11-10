/**
 * Gera o ícone vetorial provisório e os ícones do app (favicon, PWA, iPhone).
 *
 * A casa com as três barras foi redesenhada em SVG com as medidas da logo
 * original (public/brand/logo-original.jpeg), mas com as cores
 * oficiais de src/config/brand.ts. Quando a logo vetorial definitiva chegar,
 * troque public/brand/icon.svg por ela e ajuste este script.
 *
 * Uso: npm run icons
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readBrandColors() {
  const source = await readFile(join(root, "src/config/brand.ts"), "utf8");
  const color = (name) => {
    const match = source.match(new RegExp(`${name}:\\s*"(#[0-9a-fA-F]{6})"`));
    if (!match) throw new Error(`Cor "${name}" não encontrada em brand.ts`);
    return match[1];
  };
  return { navy: color("navy"), gold: color("gold"), white: color("white") };
}

/** Desenho da casa nas coordenadas da logo original (centro em 509, 341). */
function houseMark({ gold, white }) {
  return `
    <path d="M268 331 L509 141 L748 331" fill="none" stroke="${gold}" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M629 236 V178 Q629 170 637 170 H672 Q680 170 680 178 V276 Z" fill="${gold}"/>
    <path d="M321.5 289 V541.5 H697 V289" fill="none" stroke="${gold}" stroke-width="36" stroke-linejoin="round"/>
    <rect x="383" y="425" width="66" height="100" rx="5" fill="${white}"/>
    <rect x="476" y="371" width="66" height="154" rx="5" fill="${white}"/>
    <rect x="569" y="309" width="67" height="216" rx="5" fill="${gold}"/>`;
}

/**
 * Ícone quadrado 512x512. `scale` controla quanto da área a casa ocupa
 * (ícones "maskable" precisam de mais margem: o sistema recorta em círculo).
 */
function iconSvg(colors, { scale, radius = 0 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${colors.navy}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-509 -341)">${houseMark(colors)}
  </g>
</svg>
`;
}

async function png(svg, size, file) {
  await mkdir(dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  console.log(`  ${file.replace(root, "").slice(1)} (${size}x${size})`);
}

const colors = await readBrandColors();
const regular = iconSvg(colors, { scale: 0.74 });
const rounded = iconSvg(colors, { scale: 0.74, radius: 96 });
const maskable = iconSvg(colors, { scale: 0.56 });

console.log("Gerando ícones:");
await writeFile(join(root, "public/brand/icon.svg"), regular);
console.log("  public/brand/icon.svg");
// Favicon (Next.js usa src/app/icon.svg automaticamente).
await writeFile(join(root, "src/app/icon.svg"), rounded);
console.log("  src/app/icon.svg");
// iPhone: quadrado cheio, o próprio sistema arredonda os cantos.
await png(regular, 180, join(root, "src/app/apple-icon.png"));
// PWA (referenciados em src/app/manifest.ts).
await png(regular, 192, join(root, "public/icons/icon-192.png"));
await png(regular, 512, join(root, "public/icons/icon-512.png"));
await png(maskable, 512, join(root, "public/icons/icon-maskable-512.png"));
