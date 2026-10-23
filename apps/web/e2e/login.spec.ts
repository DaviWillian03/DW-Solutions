import { readFileSync } from 'node:fs';
import { type BrowserContext, type Page, expect, test } from '@playwright/test';
import { totp } from './totp';

const state = JSON.parse(readFileSync(new URL('./.state.json', import.meta.url), 'utf8')) as {
  email: string;
  invitePath: string;
};
const PASSWORD = 'Frase-Longa-de-Teste-E2E-2026';
// CAPTURAS=1 salva imagens das telas em docs/design/telas-a3 (revisão visual).
const SHOTS = process.env.CAPTURAS ? new URL('../../../docs/design/telas-a3/', import.meta.url) : null;
const shot = async (p: Page, name: string) => {
  if (SHOTS) await p.screenshot({ path: new URL(`${name}.png`, SHOTS).pathname, fullPage: true });
};

test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let page: Page;
let secret = '';
let backupCodes: string[] = [];

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  // Autenticador virtual (digital/PIN simulado) para testar chaves de acesso de verdade (WebAuthn).
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
});

test.afterAll(async () => {
  await context.close();
});

test('sem sessão, a visão geral manda para Entrar', async () => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, '01-entrar');
});

test('convite: cria senha, cadastra app autenticador, guarda códigos e chave de acesso', async () => {
  await page.goto(state.invitePath);
  await expect(page).toHaveURL(/\/convite$/); // token removido da barra de endereço
  await page.getByLabel('Nova senha').fill('curta');
  await page.getByLabel('Confirme a senha').fill('curta');
  await page.getByRole('button', { name: 'Criar senha e entrar' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('12 caracteres');

  await page.getByLabel('Nova senha').fill(PASSWORD);
  await page.getByLabel('Confirme a senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar senha e entrar' }).click();

  // Admin sem MFA é levado ao cadastro obrigatório.
  await expect(page).toHaveURL(/\/configurar-seguranca$/);
  await expect(page.getByText('Passo 1 de 4')).toBeVisible();
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByAltText('QR code para cadastrar no app autenticador')).toBeVisible();
  await shot(page, '03-configurar-app-autenticador');
  await page.getByText('Não consegue escanear? Digite a chave').click();
  secret = (await page.getByTestId('totp-secret').innerText()).replace(/\s/g, '');
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);

  await page.getByLabel('Código de 6 dígitos').fill('000000');
  await page.getByRole('button', { name: 'Ativar verificação' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Código inválido');
  await page.getByLabel('Código de 6 dígitos').fill(totp(secret));
  await page.getByRole('button', { name: 'Ativar verificação' }).click();

  await expect(page.getByText('Verificação em duas etapas ativada.')).toBeVisible();
  backupCodes = await page.getByTestId('backup-codes').locator('li').allInnerTexts();
  expect(backupCodes).toHaveLength(10);
  await shot(page, '04-codigos-de-recuperacao');
  const continuar = page.getByRole('button', { name: 'Continuar' });
  await expect(continuar).toBeDisabled();
  await page.getByLabel('Guardei meus códigos de recuperação em local seguro.').check();
  await continuar.click();

  await page.getByRole('button', { name: 'Cadastrar chave de acesso' }).click();
  await expect(page.getByRole('heading', { name: /Olá, Ana!/ })).toBeVisible();
  await expect(page.getByText('DADOS SIMULADOS')).toBeVisible();
  await expect(page.getByText('Administrador · Comercial Exemplo Ltda (fictícia)')).toBeVisible();
  await page.waitForTimeout(800); // fim das animações de entrada
  await shot(page, '05-visao-geral');
});

test('convite não pode ser reutilizado', async ({ browser }) => {
  const other = await browser.newPage();
  await other.goto(state.invitePath);
  await other.getByLabel('Nova senha').fill(PASSWORD);
  await other.getByLabel('Confirme a senha').fill(PASSWORD);
  await other.getByRole('button', { name: 'Criar senha e entrar' }).click();
  await expect(other.locator('main').getByRole('alert')).toContainText('inválido, expirou ou já foi usado');
  await other.close();
});

test('sair e entrar com senha + código do app', async () => {
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByLabel('E-mail').fill(state.email);
  await page.getByLabel('Senha').fill('Senha-Errada-123456');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toHaveText('E-mail ou senha incorretos.');

  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/verificacao$/);
  await shot(page, '02-verificacao');
  await page.getByLabel('Código do app').fill('111111');
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.locator('main').getByRole('alert')).toBeVisible();
  // Código do próximo intervalo (aceito pela tolerância) para não repetir o já usado.
  await page.getByLabel('Código do app').fill(totp(secret, Date.now() + 30_000));
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByRole('heading', { name: /Olá, Ana!/ })).toBeVisible();
});

test('entrar com código de recuperação', async () => {
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.getByLabel('E-mail').fill(state.email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Usar um código de recuperação' }).click();
  await page.getByLabel('Código de recuperação').fill(backupCodes[0]!);
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByRole('heading', { name: /Olá, Ana!/ })).toBeVisible();
});

test('entrar com chave de acesso, sem senha', async () => {
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByRole('button', { name: 'Entrar com chave de acesso' }).click();
  await expect(page.getByRole('heading', { name: /Olá, Ana!/ })).toBeVisible();
});

test('cookie de sessão é HttpOnly, Secure e SameSite=Lax', async () => {
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name.endsWith('dw.session_token'));
  expect(session).toBeDefined();
  expect(session!.httpOnly).toBe(true);
  expect(session!.secure).toBe(true);
  expect(session!.sameSite).toBe('Lax');
  expect(await page.evaluate(() => document.cookie)).not.toContain('session_token');
});
