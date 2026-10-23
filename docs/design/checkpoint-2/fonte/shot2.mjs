import { chromium } from 'playwright-core';
const [dir] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const jobs = [
  ['direcao-d1-azul-real', 'light'], ['direcao-d1-azul-real', 'dark'],
  ['direcao-d2-azul-gelo', 'light'], ['direcao-d2-azul-gelo', 'dark'],
  ['monogramas-dw', 'light'],
];
for (const [f, scheme] of jobs) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  await p.goto(`file://${dir}/${f}.html`);
  await p.evaluate(() => document.fonts.ready);
  const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await p.screenshot({ path: `${dir}/${f}-${scheme === 'light' ? 'claro' : 'escuro'}.png`, fullPage: true });
  console.log(f, scheme, 'overflow horizontal:', over);
  await p.close();
}
await b.close();
