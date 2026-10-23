import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [dir, outDir] = process.argv.slice(2);
const exe = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
const b = await chromium.launch({ executablePath: exe });
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.html'))) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await p.goto('file://' + dir + '/' + f);
  await p.evaluate(() => document.fonts.ready);
  const fonts = await p.evaluate(() => [...document.fonts].filter(x => x.status === 'loaded').map(x => x.family + ' ' + x.weight));
  await p.screenshot({ path: `${outDir}/${f.replace('.html', '.png')}`, fullPage: true });
  console.log(f, 'fontes carregadas:', fonts.join(', '));
  await p.close();
}
await b.close();
