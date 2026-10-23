import { expect, test } from '@playwright/test';

// Tema segue o sistema (CP2-2): confere que o modo escuro aplica a paleta própria.
test.use({ colorScheme: 'dark' });

test('tela Entrar no tema escuro', async ({ page }) => {
  await page.goto('/entrar');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(6, 13, 28)'); // #060D1C
  if (process.env.CAPTURAS) {
    await page.waitForTimeout(500);
    await page.screenshot({
      path: new URL('../../../docs/design/telas-a3/06-entrar-escuro.png', import.meta.url).pathname,
    });
  }
});

test('respeita "reduzir movimento"', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/entrar');
  const anim = await page
    .locator('.dw-rise')
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe('none');
  await ctx.close();
});
