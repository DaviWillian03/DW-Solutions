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
  if (SHOTS) await p.evaluate(() => window.scrollTo(0, 0));
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
  await expect(page.getByText('Olá, Ana ·')).toBeVisible();
  await expect(page.getByText('DADOS SIMULADOS')).toBeVisible();
  await expect(page.locator('header').getByText('Administrador')).toBeVisible();
  await page.waitForTimeout(800); // fim das animações de entrada
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
  await expect(page.getByText('Olá, Ana ·')).toBeVisible();
});

test('entrar com código de recuperação', async () => {
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.getByLabel('E-mail').fill(state.email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Usar um código de recuperação' }).click();
  await page.getByLabel('Código de recuperação').fill(backupCodes[0]!);
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByText('Olá, Ana ·')).toBeVisible();
});

test('entrar com chave de acesso, sem senha', async () => {
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByRole('button', { name: 'Entrar com chave de acesso' }).click();
  await expect(page.getByText('Olá, Ana ·')).toBeVisible();
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

// ---------------------------------------------------------------------------
// Fase B — gestão de aparelhos (mesma sessão do administrador)
// ---------------------------------------------------------------------------
const SHOTS_B = process.env.CAPTURAS ? new URL('../../../docs/design/telas-b/', import.meta.url) : null;
const shotB = async (p: Page, name: string) => {
  if (SHOTS_B) {
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(900);
    await p.screenshot({ path: new URL(`${name}.png`, SHOTS_B).pathname, fullPage: true });
  }
};

test('visão geral mostra números reais do simulador, com origem e horário', async () => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Aparelhos gerenciados/ })).toContainText('120');
  await expect(page.getByText('origem:', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Precisam de atenção')).toBeVisible();
  await shotB(page, '01-visao-geral');
});

test('lista filtra por comunicação e busca por nome', async () => {
  await page
    .getByRole('link', { name: /Sem sinal/ })
    .first()
    .click();
  await expect(page).toHaveURL(/connectivity=silent/);
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  for (const pill of await page
    .locator('tbody')
    .getByText(/Com sinal|Desconhecido/)
    .all()) {
    await expect(pill).not.toBeVisible();
  }
  await page.goto('/aparelhos');
  await shotB(page, '02-aparelhos');
  const nome = (await page.locator('tbody tr td a').first().innerText()).trim();
  await page.getByLabel('Buscar aparelho').fill(nome);
  await expect(page).toHaveURL(/search=/);
  await expect(page.locator('tbody tr td a').first()).toHaveText(nome);
});

test('página do aparelho: resumo, capacidades honestas e troca de responsável auditada', async () => {
  await page.goto('/aparelhos?holder=unassigned');
  await page.locator('tbody tr td a').first().click();
  await expect(page.getByRole('tab', { name: 'Resumo' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Nada aqui é “ao vivo”.')).toBeVisible();
  await shotB(page, '03-aparelho');

  await page.getByRole('tab', { name: 'Capacidades' }).click();
  await expect(page.getByText('Localização contínua')).toBeVisible();
  await expect(page.getByText('Não suportada')).toBeVisible();

  await page.getByRole('tab', { name: 'Responsável' }).click();
  await page.getByLabel('Novo responsável').selectOption({ index: 1 });
  await page.getByLabel('Motivo (fica na auditoria)').fill('entrega para nova rota');
  await page.getByRole('button', { name: 'Salvar responsável' }).click();
  await expect(page.getByText('Responsável atualizado e registrado na auditoria.')).toBeVisible();

  await page.getByRole('tab', { name: 'Linha do tempo' }).click();
  await expect(page.getByText('Responsável definido').first()).toBeVisible();
});

test('cadastro por QR de DEMONSTRAÇÃO conclui de forma assíncrona', async () => {
  await page.goto('/aparelhos/cadastrar');
  await page.getByLabel('Nome do aparelho (opcional)').fill('Galaxy A25 · Vendas E2E');
  await page.getByRole('button', { name: 'Gerar QR code' }).click();
  await expect(page.locator('main').getByRole('alert')).toHaveText(
    'DEMONSTRAÇÃO — NÃO PROVISIONA DISPOSITIVO',
  );
  await expect(page.getByAltText('QR code de demonstração (não provisiona aparelhos)')).toBeVisible();
  await expect(page.getByText('Aguardando leitura do QR')).toBeVisible();
  await shotB(page, '04-cadastrar-qr');
  await page.getByRole('button', { name: 'Simular leitura do QR' }).click();
  await expect(page.getByText('Aparelho cadastrado (simulado)')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('link', { name: 'Abrir Galaxy A25 · Vendas E2E' }).click();
  await expect(page.getByRole('heading', { name: 'Galaxy A25 · Vendas E2E' })).toBeVisible();
});

test('responsáveis: cadastrar novo', async () => {
  await page.goto('/responsaveis');
  await page.getByLabel('Nome completo').fill('Promotora E2E');
  await page.getByLabel('Matrícula (opcional)').fill('E2E-01');
  await page.getByLabel('Área').selectOption('merchandising');
  await page.getByRole('button', { name: 'Cadastrar responsável' }).click();
  await expect(page.getByText('Responsável cadastrado.')).toBeVisible();
  await page.getByLabel('Buscar responsável').fill('Promotora E2E');
  await expect(page.getByRole('cell', { name: 'Promotora E2E' })).toBeVisible();
  await shotB(page, '05-responsaveis');
});

let viewerInvite = '';
test('usuários: convite de perfil Leitura mostrado uma única vez', async () => {
  await page.goto('/usuarios');
  await page.getByLabel('Nome').fill('Leo Leitura');
  await page.getByLabel('E-mail').fill('leo.leitura@comercial-exemplo.test');
  await page.getByRole('button', { name: 'Gerar convite' }).click();
  viewerInvite = await page.getByTestId('invite-url').innerText();
  expect(viewerInvite).toMatch(/\/convite#[A-Za-z0-9_-]{43}$/);
  await shotB(page, '06-usuarios');
});

test('perfil Leitura consulta aparelhos mas não vê ações de administrador', async ({ browser }) => {
  const ctx = await browser.newContext();
  const v = await ctx.newPage();
  await v.goto(new URL(viewerInvite).pathname + new URL(viewerInvite).hash);
  await v.getByLabel('Nova senha').fill(PASSWORD);
  await v.getByLabel('Confirme a senha').fill(PASSWORD);
  await v.getByRole('button', { name: 'Criar senha e entrar' }).click();
  await expect(v.getByText('Olá, Leo ·')).toBeVisible();
  await v.goto('/aparelhos');
  await expect(v.locator('tbody tr').first()).toBeVisible();
  await expect(v.getByRole('button', { name: 'Cadastrar aparelho' })).toHaveCount(0);
  await v.locator('tbody tr td a').first().click();
  await v.getByRole('tab', { name: 'Responsável' }).click();
  await expect(v.getByText('Seu perfil (Leitura) não permite alterar o responsável.')).toBeVisible();
  await v.getByRole('tab', { name: 'Política' }).click();
  await expect(v.getByText('Seu perfil (Leitura) não permite trocar a política.')).toBeVisible();
  await v.getByRole('tab', { name: 'Comandos' }).click();
  await expect(v.getByText('Somente administradores').first()).toBeVisible();
  await v.goto('/auditoria');
  await expect(v.getByText('Somente administradores consultam a auditoria')).toBeVisible();
  await v.goto('/politicas');
  await v.getByRole('link', { name: 'Abrir política Vendas' }).click();
  await expect(v.getByText('Editar', { exact: true })).toHaveAttribute('aria-disabled', 'true');
  await ctx.close();
});

test('visão geral no tema escuro', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark', storageState: await context.storageState() });
  const p = await ctx.newPage();
  await p.goto('/');
  await expect(p.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  await shotB(p, '07-visao-geral-escuro');
  await ctx.close();
});

// ---------------------------------------------------------------------------
// Fase C — políticas e conformidade (mesma sessão do administrador)
// ---------------------------------------------------------------------------
const SHOTS_C = process.env.CAPTURAS ? new URL('../../../docs/design/telas-c/', import.meta.url) : null;
const shotC = async (p: Page, name: string) => {
  if (SHOTS_C) {
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(900);
    await p.screenshot({ path: new URL(`${name}.png`, SHOTS_C).pathname, fullPage: true });
  }
};

test('aparelho não conforme mostra o motivo e como resolver', async () => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Fora da política/ })).toBeVisible();
  await page.goto('/aparelhos');
  await page.getByLabel('Conformidade').selectOption('noncompliant');
  await expect(page).toHaveURL(/compliance=noncompliant/);
  await page.locator('tbody tr td a').first().click();
  await page.getByRole('tab', { name: 'Política' }).click();
  await expect(page.locator('main').getByText('Não conforme').first()).toBeVisible();
  await expect(page.getByText('Como resolver:').first()).toBeVisible();
  await expect(page.getByText('Versão aplicada')).toBeVisible();
  // O seletor mostra a política atual (não “Sem política”) depois que as opções carregam.
  await expect(page.getByLabel('Trocar política')).toHaveValue(/^[0-9a-f-]{36}$/);
  await shotC(page, '05-aparelho-politica');
});

test('políticas: lista com conformidade e configuração da política', async () => {
  await page.goto('/politicas');
  await expect(page.getByRole('heading', { name: 'Políticas', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir política Merchandising' })).toBeVisible();
  await shotC(page, '01-politicas');
  await page.getByRole('link', { name: 'Abrir política Vendas' }).click();
  await expect(page.getByRole('heading', { name: 'Política Vendas' })).toBeVisible();
  await expect(page.getByText('Configuração da versão 1')).toBeVisible();
  await expect(page.getByText('Pedidos (fictício)')).toBeVisible();
  await shotC(page, '02-politica-configuracao');
});

test('editar: só publica depois de simular o impacto; histórico e comparação', async () => {
  await page.getByRole('tab', { name: 'Editar' }).click();
  await page.getByLabel('Versão mínima do Android').selectOption('14');
  await expect(page.getByRole('button', { name: 'Publicar versão 2' })).toBeDisabled();
  await page.getByRole('button', { name: 'Simular impacto' }).click();
  await expect(page.getByRole('cell', { name: 'Versão mínima do Android' })).toBeVisible();
  await expect(page.getByText('passariam a ficar não conformes')).toBeVisible();
  await page
    .getByLabel('Motivo da mudança (fica no histórico e na auditoria)')
    .fill('Exigir Android 14 na rua');
  await shotC(page, '03-politica-simulacao');
  // Mudou depois de simular → precisa simular de novo.
  await page.getByLabel('Bloqueio automático da tela').selectOption('5');
  await expect(page.getByRole('button', { name: 'Publicar versão 2' })).toBeDisabled();
  await page.getByRole('button', { name: 'Simular impacto' }).click();
  await page.getByRole('button', { name: 'Publicar versão 2' }).click();

  await expect(page.getByRole('tab', { name: 'Versões (2)' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('“Exigir Android 14 na rua”')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Android 14' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Após 5 min sem uso' })).toBeVisible();
  await shotC(page, '04-politica-versoes');
});

test('conflito: edição feita sobre versão antiga não sobrescreve a mais nova', async () => {
  const other = await context.newPage();
  await other.goto(page.url());
  await other.getByRole('tab', { name: 'Editar' }).click();
  await other.getByLabel('Tamanho mínimo da senha').fill('8');
  await other.getByRole('button', { name: 'Simular impacto' }).click();
  await other.getByLabel('Motivo da mudança (fica no histórico e na auditoria)').fill('senha maior');

  // Enquanto isso, outra aba publica a versão 3.
  await page.getByRole('tab', { name: 'Editar' }).click();
  await page.getByLabel('Bloqueio automático da tela').selectOption('10');
  await page.getByRole('button', { name: 'Simular impacto' }).click();
  await page.getByLabel('Motivo da mudança (fica no histórico e na auditoria)').fill('bloqueio em 10 min');
  await page.getByRole('button', { name: 'Publicar versão 3' }).click();
  await expect(page.getByRole('tab', { name: 'Versões (3)' })).toBeVisible();

  await other.getByRole('button', { name: 'Publicar versão 3' }).click();
  await expect(other.locator('main').getByRole('alert')).toContainText('mudou enquanto você editava');
  await other.getByRole('button', { name: 'Carregar a versão atual' }).click();
  await expect(other.getByText('Editando a partir da versão 3')).toBeVisible();
  await other.close();
});

test('lista: troca a política de vários aparelhos de uma vez', async () => {
  await page.goto('/aparelhos');
  await page.getByLabel('Política', { exact: true }).selectOption({ label: 'Merchandising' });
  await page.getByLabel('Conformidade').selectOption('noncompliant');
  await expect(page).toHaveURL(/compliance=noncompliant/);
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await page.getByLabel('Selecionar todos desta página').check();
  await page.getByLabel('Nova política').selectOption({ label: 'Vendas' });
  await page.getByLabel('Motivo (fica na auditoria)').fill('promotores remanejados para vendas');
  await shotC(page, '06-aparelhos-lote');
  await page.getByRole('button', { name: 'Aplicar aos selecionados' }).click();
  await expect(page.getByText(/aparelho\(s\) atualizado\(s\)/)).toBeVisible();
  await expect(page.getByText('Nenhum aparelho encontrado com estes filtros.')).toBeVisible();
});

test('ilustrações: nenhum aparelho fora da política e política sem aparelhos', async () => {
  await page.goto('/politicas');
  await page.getByRole('link', { name: 'Abrir política Merchandising' }).click();
  await page.getByRole('tab', { name: /Aparelhos/ }).click();
  await page.getByRole('button', { name: 'Não conformes' }).click();
  await expect(page.getByText('Nenhum aparelho fora da política')).toBeVisible();
  await shotC(page, '07-ilustracao-tudo-conforme');

  // Move o restante para Vendas: a política fica sem aparelhos.
  const merchUrl = page.url();
  await page.getByRole('link', { name: 'Abrir na lista de Aparelhos' }).click();
  await expect(page).toHaveURL(/\/aparelhos\?policy=/);
  await page.goto(`${page.url()}&pageSize=100`);
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await page.getByLabel('Selecionar todos desta página').check();
  await page.getByLabel('Nova política').selectOption({ label: 'Vendas' });
  await page.getByLabel('Motivo (fica na auditoria)').fill('equipe de merchandising encerrada');
  await page.getByRole('button', { name: 'Aplicar aos selecionados' }).click();
  await expect(page.getByText('Nenhum aparelho encontrado com estes filtros.')).toBeVisible();
  await page.goto(merchUrl);
  await page.getByRole('tab', { name: 'Aparelhos (0)' }).click();
  await expect(page.getByText('Nenhum aparelho usa esta política ainda')).toBeVisible();
  await shotC(page, '08-ilustracao-sem-aparelhos');

  const ctx = await page
    .context()
    .browser()!
    .newContext({
      colorScheme: 'dark',
      storageState: await context.storageState(),
    });
  const dark = await ctx.newPage();
  await dark.goto(merchUrl);
  await dark.getByRole('tab', { name: 'Aparelhos (0)' }).click();
  await expect(dark.getByText('Nenhum aparelho usa esta política ainda')).toBeVisible();
  await shotC(dark, '09-ilustracao-escuro');
  await ctx.close();
});

// ---------------------------------------------------------------------------
// Fase D — comandos (mesma sessão do administrador). Cada código do app só vale uma vez no
// “refazer MFA”, então cada uso pega uma janela de 30 s diferente e crescente.
// ---------------------------------------------------------------------------
const SHOTS_D = process.env.CAPTURAS ? new URL('../../../docs/design/telas-d/', import.meta.url) : null;
const shotD = async (p: Page, name: string, fullPage = true) => {
  if (SHOTS_D) {
    if (fullPage) await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(900);
    await p.screenshot({ path: new URL(`${name}.png`, SHOTS_D).pathname, fullPage });
  }
};
const onlineDevice = async (index: number) => {
  await page.goto('/aparelhos?connectivity=online&sort=name');
  const link = page.locator('tbody tr td a').nth(index);
  const name = (await link.innerText()).trim();
  await link.click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  return name;
};

test('modo perdido: do pedido até a aplicação verificada pelo aparelho', async () => {
  const name = await onlineDevice(0);
  await page.getByRole('tab', { name: 'Comandos' }).click();
  await page.getByRole('button', { name: 'Ativar modo perdido…' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Telefone de contato (opcional)').fill('(11) 4000-0000');
  await dialog.getByLabel(/Motivo/).fill('perdido na rota Norte');
  await dialog.getByLabel(/Para confirmar, digite o nome do aparelho/).fill(name);
  await shotD(page, '01-dialogo-modo-perdido', false);
  await dialog.getByRole('button', { name: 'Ativar modo perdido', exact: true }).click();
  await expect(page.getByText('“Ativar modo perdido” enviado.')).toBeVisible();
  // Aparelho intermitente pode não ser “acordado” pelo provedor: força a comunicação (simulador).
  await page.getByRole('button', { name: 'Simular comunicação do aparelho agora' }).click();
  const cmd = page.getByTestId('command').first();
  await expect(cmd.getByText('✓ Aplicação verificada')).toBeVisible({ timeout: 20_000 });
  await expect(cmd.getByText('✓ Confirmado pelo provedor')).toBeVisible();
  await expect(cmd.getByText('✓ Recebido pelo aparelho')).toBeVisible();
  await expect(page.locator('main').getByText('Em modo perdido').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Desativar modo perdido…' })).toBeVisible();
  await shotD(page, '02-aparelho-comandos');
});

test('apagar 1 aparelho: desligado por padrão; ligar e apagar exigem o código do app', async () => {
  const name = await onlineDevice(1);
  await page.getByRole('tab', { name: 'Comandos' }).click();
  await page.getByRole('button', { name: 'Apagar aparelho…' }).click();
  await expect(page.getByRole('dialog').getByText('Apagar aparelhos está desligado')).toBeVisible();
  const deviceUrl = page.url();
  await page.getByRole('dialog').getByRole('link', { name: 'Configurações' }).click();

  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
  await page.getByLabel('Código do app autenticador').fill('000000');
  await page.getByRole('button', { name: 'Ligar apagamento de aparelhos' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Código inválido');
  await page.getByLabel('Código do app autenticador').fill(totp(secret, Date.now() - 30_000));
  await page.getByRole('button', { name: 'Ligar apagamento de aparelhos' }).click();
  await expect(page.getByText('Apagar aparelhos foi ligado.')).toBeVisible();
  await shotD(page, '03-configuracoes');

  await page.goto(deviceUrl);
  await page.getByRole('tab', { name: 'Comandos' }).click();
  await page.getByRole('button', { name: 'Apagar aparelho…' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('IRREVERSÍVEL')).toBeVisible();
  await dialog.getByLabel(/Motivo/).fill('aparelho roubado, boletim 1234');
  await dialog.getByLabel(/Para confirmar, digite o nome do aparelho/).fill('nome errado');
  await dialog.getByLabel('Código do app autenticador').fill(totp(secret));
  await shotD(page, '04-dialogo-apagar', false);
  await dialog.getByRole('button', { name: 'Apagar aparelho', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('nome do aparelho');
  await dialog.getByLabel(/Para confirmar, digite o nome do aparelho/).fill(name);
  await dialog.getByRole('button', { name: 'Apagar aparelho', exact: true }).click();
  await expect(page.getByText('“Apagar aparelho” enviado.')).toBeVisible();
  await page.getByRole('button', { name: 'Simular comunicação do aparelho agora' }).click();
  await expect(page.getByTestId('command').first().getByText('✓ Aplicação verificada')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('Apagado · fora do gerenciamento')).toBeVisible({ timeout: 10_000 });
});

test('lote: bloquear vários; apagar vários só com aprovação de OUTRO administrador', async () => {
  await page.goto('/aparelhos?connectivity=online&sort=name');
  const rows = page.locator('tbody tr');
  await rows.nth(3).getByRole('checkbox').check();
  await rows.nth(4).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Bloquear', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar comando' }).click();
  await expect(page.getByText('2 comando(s) na fila.')).toBeVisible();

  await rows.nth(5).getByRole('checkbox').check();
  await rows.nth(6).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Apagar…' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Motivo/).fill('loja Centro fechada');
  await dialog.getByLabel(/Para confirmar, digite/).fill('APAGAR 2');
  await dialog.getByLabel('Código do app autenticador').fill(totp(secret, Date.now() + 30_000));
  await dialog.getByRole('button', { name: 'Pedir aprovação' }).click();
  await expect(page.getByText(/enviado para aprovação de outro administrador/)).toBeVisible();

  await page.getByRole('link', { name: 'Comandos', exact: true }).first().click();
  const approval = page.getByTestId('approval').first();
  await expect(approval.getByText('Aguardando outro administrador aprovar.')).toBeVisible();
  await expect(approval.getByRole('button', { name: 'Aprovar apagamento…' })).toHaveCount(0);
  // Aceite do provedor aparece logo; a aplicação depende de cada aparelho comunicar.
  await expect(page.getByText('✓ Confirmado pelo provedor').first()).toBeVisible({ timeout: 20_000 });
  await shotD(page, '05-comandos-aprovacao');

  await approval.getByRole('button', { name: 'Retirar pedido…' }).click();
  await page
    .getByRole('dialog')
    .getByLabel(/Motivo/)
    .fill('aparelhos foram recolhidos');
  await page.getByRole('dialog').getByRole('button', { name: 'Recusar pedido' }).click();
  await expect(page.getByText('Pedido recusado. Os comandos foram cancelados.')).toBeVisible();
  await expect(page.getByText('Nenhum pedido aguardando aprovação.')).toBeVisible();
});

test('visão geral mostra comandos em andamento e modo perdido', async () => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Comandos em andamento/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Em modo perdido/ })).toContainText('1');
  await shotD(page, '06-visao-geral');
});

// ---------------------------------------------------------------------------
// Fase E — auditoria (M11)
// ---------------------------------------------------------------------------
test('auditoria: quem fez o quê, tentativas negadas, filtros e integridade do registro', async () => {
  await page.goto('/auditoria');
  await expect(page.getByText(/^Íntegro: \d+ registros conferidos/)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Comando pedido' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Ana Admin' }).first()).toBeVisible();
  await shotD(page, '07-auditoria');

  await page.getByLabel('Resultado').selectOption('denied');
  await expect(page).toHaveURL(/outcome=denied/);
  await expect(page.getByRole('cell', { name: 'Verificação em duas etapas refeita' }).first()).toBeVisible();
  for (const pill of await page
    .locator('tbody')
    .getByText(/^Concluída$/)
    .all())
    await expect(pill).not.toBeVisible();
  await page.getByRole('button', { name: 'Detalhes' }).first().click();
  await expect(page.getByText('código inválido').first()).toBeVisible();

  // Do aparelho para a auditoria dele.
  await page.goto('/aparelhos?connectivity=online&sort=name');
  const name = (await page.locator('tbody tr td a').first().innerText()).trim();
  await page.locator('tbody tr td a').first().click();
  await page.getByRole('tab', { name: 'Linha do tempo' }).click();
  await page.getByRole('link', { name: 'Ver na auditoria' }).click();
  await expect(page).toHaveURL(/targetId=/);
  await expect(page.getByRole('link', { name }).first()).toBeVisible();
});
