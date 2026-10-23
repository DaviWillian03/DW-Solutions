// Gera os arquivos finais da marca DW Solutions (aprovados no CHECKPOINT 2):
// - M2 "Traço contínuo" = monograma principal (SVG claro/escuro, assinatura com nome em curvas)
// - M1 "Selo" = ícone pequeno (favicon 16/32/48, .ico) e ícone de app (PWA 192/512, maskable)
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import { chromium } from 'playwright-core';

const OUT = process.argv[2];
for (const d of ['svg', 'png', 'favicon', 'app']) fs.mkdirSync(path.join(OUT, d), { recursive: true });

const C = { marinho: '#0A1F4D', royal: '#1A4FD6', azure: '#2F6BFF', ceu: '#8CB4FF', branco: '#FFFFFF', fundoEscuro: '#060D1C' };

// ---------- texto em curvas (sem depender da fonte instalada) ----------
const buf = fs.readFileSync('node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff');
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
function textPath(str, x, y, size, tracking = -0.02) {
  const scale = size / font.unitsPerEm;
  let cx = x;
  let d = '';
  let prev = null;
  for (const ch of str) {
    const g = font.charToGlyph(ch);
    if (prev) cx += font.getKerningValue(prev, g) * scale;
    d += g.getPath(cx, y, size).toPathData(2);
    cx += g.advanceWidth * scale + tracking * size;
    prev = g;
  }
  return { d, width: cx - x - tracking * size };
}

// ---------- monogramas ----------
// M2: traço com degradê; no escuro, céu → branco.
const m2 = (a, b, id) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<path d="M4 10h5.5a10 10 0 0 1 0 20H4z" fill="none" stroke="url(#${id})" stroke-width="3.4" stroke-linejoin="round"/>
<path d="M19.5 10.5l3.2 19 4.3-12 4.3 12 3.2-19" fill="none" stroke="url(#${id})" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
const M2_CLARO = [C.marinho, C.azure];
const M2_ESCURO = [C.ceu, C.branco];

// M1: selo para tamanhos pequenos. "full" = sangra até a borda (ícone de app maskable).
const m1 = (id, full = false) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.marinho}"/><stop offset="1" stop-color="${C.royal}"/></linearGradient></defs>
${full ? `<rect width="40" height="40" fill="url(#${id})"/>` : `<rect width="40" height="40" rx="11" fill="url(#${id})"/><rect x="1.5" y="1.5" width="37" height="37" rx="9.5" fill="none" stroke="${C.ceu}" stroke-opacity=".45"/>`}
<g ${full ? 'transform="translate(8 8) scale(.6)"' : ''}><path d="M8 12.5h4a7.5 7.5 0 0 1 0 15H8z" fill="none" stroke="#fff" stroke-width="2.8" stroke-linejoin="round"/>
<path d="M21.5 13l2.4 14 3.1-9 3.1 9 2.4-14" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;

const svg = (w, h, inner, title) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}"><title>${title}</title>${inner}</svg>\n`;

const files = {};
files['svg/dw-monograma-claro.svg'] = svg(40, 40, m2(...M2_CLARO, 'g'), 'DW Solutions');
files['svg/dw-monograma-escuro.svg'] = svg(40, 40, m2(...M2_ESCURO, 'g'), 'DW Solutions');
files['svg/dw-selo.svg'] = svg(40, 40, m1('g'), 'DW Solutions');

// Assinatura horizontal: monograma (40) + 12 de respiro + nome em curvas.
const nome = textPath('DW Solutions', 52, 28.5, 22);
const W = Math.ceil(52 + nome.width + 2);
files['svg/dw-assinatura-claro.svg'] = svg(W, 40, `${m2(...M2_CLARO, 'g')}<path d="${nome.d}" fill="#0A1730"/>`, 'DW Solutions');
files['svg/dw-assinatura-escuro.svg'] = svg(W, 40, `${m2(...M2_ESCURO, 'g')}<path d="${nome.d}" fill="#EEF3FF"/>`, 'DW Solutions');

// Favicon SVG (navegadores modernos) e ícone de app maskable
files['favicon/favicon.svg'] = files['svg/dw-selo.svg'];
files['app/icone-app-maskable.svg'] = svg(40, 40, m1('g', true), 'DW Solutions');
for (const [f, c] of Object.entries(files)) fs.writeFileSync(path.join(OUT, f), c);

// ---------- rasterização com Chromium ----------
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
async function raster(svgFile, out, w, h, bg = 'transparent') {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const s = fs.readFileSync(path.join(OUT, svgFile), 'utf8').replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`);
  await p.setContent(`<html><body style="margin:0;background:${bg}">${s}</body></html>`);
  await p.locator('svg').screenshot({ path: path.join(OUT, out), omitBackground: bg === 'transparent' });
  await p.close();
}
await raster('svg/dw-monograma-claro.svg', 'png/dw-monograma-claro-512.png', 512, 512);
await raster('svg/dw-monograma-escuro.svg', 'png/dw-monograma-escuro-512.png', 512, 512);
await raster('svg/dw-assinatura-claro.svg', 'png/dw-assinatura-claro.png', W * 8, 320);
await raster('svg/dw-assinatura-escuro.svg', 'png/dw-assinatura-escuro.png', W * 8, 320);
for (const s of [16, 32, 48]) await raster('svg/dw-selo.svg', `favicon/favicon-${s}.png`, s, s);
await raster('svg/dw-selo.svg', 'favicon/apple-touch-icon-180.png', 180, 180);
await raster('app/icone-app-maskable.svg', 'app/icone-app-192.png', 192, 192);
await raster('app/icone-app-maskable.svg', 'app/icone-app-512.png', 512, 512);
await b.close();

// ---------- favicon.ico (PNG embutido, 16/32/48) ----------
const imgs = [16, 32, 48].map((s) => ({ s, data: fs.readFileSync(path.join(OUT, `favicon/favicon-${s}.png`)) }));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(imgs.length, 4);
let offset = 6 + 16 * imgs.length;
const dir = imgs.map(({ s, data }) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0); e.writeUInt8(s, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
  offset += data.length;
  return e;
});
fs.writeFileSync(path.join(OUT, 'favicon/favicon.ico'), Buffer.concat([header, ...dir, ...imgs.map((i) => i.data)]));

// Manifesto PWA de exemplo (será usado pelo app web na Fase A)
fs.writeFileSync(path.join(OUT, 'app/manifest.exemplo.json'), JSON.stringify({
  name: 'DW Solutions', short_name: 'DW Solutions', lang: 'pt-BR', theme_color: C.royal, background_color: '#FFFFFF', display: 'standalone',
  icons: [
    { src: 'icone-app-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
    { src: 'icone-app-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' },
  ],
}, null, 2) + '\n');
console.log('assinatura largura', W);
