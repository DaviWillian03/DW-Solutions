// Gera 3 protótipos estáticos (mesmos dados simulados) para o CHECKPOINT 2.
import fs from 'node:fs';
import path from 'node:path';

const NM = path.resolve('node_modules');
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const font = (pkg, file) =>
  fs.readFileSync(path.join(NM, '@fontsource', pkg, 'files', file)).toString('base64');
const fontFace = (family, pkg, slug, weights) =>
  weights
    .map(
      (w) => `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${font(pkg, `${slug}-latin-${w}-normal.woff2`)}) format('woff2');}`
    )
    .join('\n');

const icon = (name, size = 18) =>
  fs
    .readFileSync(path.join(NM, 'lucide-static/icons', `${name}.svg`), 'utf8')
    .replace(/<!--.*?-->/s, '')
    .replace('width="24"', `width="${size}"`)
    .replace('height="24"', `height="${size}"`)
    .replace('<svg', '<svg aria-hidden="true"')
    .trim();

// ---------- Dados SIMULADOS (consistentes entre si) ----------
const D = {
  org: 'Comercial Exemplo Ltda (fictícia)',
  atualizado: '23/10/2026 às 14:32',
  total: 248,
  comunicou24h: 231,
  semSinal24h: 12,
  desconhecido: 5,
  foraConformidade: 9,
  aguardandoAparelho: 3,
  lojas: [
    { nome: 'Loja Centro', tipo: 'Loja · 8 PDVs', icone: 'store', total: 62, ok: 59, semSinal: 3, desconhecido: 0, fora: 2, status: 'critico', resumo: '3 PDVs sem sinal há 26 h' },
    { nome: 'Shopping Norte', tipo: 'Loja · 6 PDVs', icone: 'store', total: 54, ok: 52, semSinal: 1, desconhecido: 1, fora: 1, status: 'ok', resumo: 'Tudo funcionando' },
    { nome: 'CD Estoque', tipo: 'Depósito · coletores', icone: 'package', total: 48, ok: 45, semSinal: 2, desconhecido: 1, fora: 3, status: 'atencao', resumo: '3 fora de conformidade' },
    { nome: 'Equipe Externa', tipo: 'Vendedores na rua', icone: 'truck', total: 84, ok: 75, semSinal: 6, desconhecido: 3, fora: 3, status: 'atencao', resumo: 'App falhou em 4 aparelhos' },
  ],
  alertas: [
    { sev: 'critico', titulo: '3 PDVs da Loja Centro sem sinal há mais de 24 h', impacto: 'Os caixas podem estar sem sistema. Verifique energia e Wi-Fi da loja.', onde: 'Loja Centro', quando: 'há 26 h' },
    { sev: 'atencao', titulo: 'App Força de Vendas falhou ao instalar em 4 aparelhos', impacto: 'Esses vendedores podem não conseguir tirar pedidos.', onde: 'Equipe Externa', quando: 'há 3 h' },
    { sev: 'atencao', titulo: '9 aparelhos com atualização de segurança atrasada', impacto: 'Correção de segurança com mais de 90 dias. Agende a atualização.', onde: '4 locais', quando: 'há 2 dias' },
    { sev: 'desconhecido', titulo: '5 aparelhos ainda sem primeira leitura', impacto: 'Estado desconhecido não significa desligado nem perdido.', onde: '3 locais', quando: 'há 1 h' },
  ],
  android: [
    { v: 'Android 12', n: 40 },
    { v: 'Android 13', n: 78 },
    { v: 'Android 14', n: 96 },
    { v: 'Android 15', n: 34 },
  ],
  fabricantes: [
    { v: 'Samsung', n: 152 },
    { v: 'Motorola', n: 96 },
  ],
  comandos: [
    { acao: 'Bloquear tela', alvo: 'Galaxy A25 · PDV 03', onde: 'Loja Centro', estado: 'aguardando', quando: 'há 2 h' },
    { acao: 'Aplicar política “Loja/PDV” v3', alvo: '54 aparelhos', onde: 'Shopping Norte', estado: 'provedor', quando: 'há 40 min' },
    { acao: 'Reiniciar', alvo: 'moto g54 · Coletor 12', onde: 'CD Estoque', estado: 'verificado', quando: 'há 15 min' },
    { acao: 'Instalar Força de Vendas', alvo: '4 aparelhos', onde: 'Equipe Externa', estado: 'falhou', quando: 'há 3 h' },
  ],
};

const ESTADO_CMD = {
  aguardando: { rotulo: 'Aguardando aparelho', icone: 'hourglass', tom: 'info' },
  provedor: { rotulo: 'Confirmado pelo provedor', icone: 'send', tom: 'info' },
  verificado: { rotulo: 'Aplicação verificada', icone: 'circle-check', tom: 'ok' },
  falhou: { rotulo: 'Falhou', icone: 'circle-x', tom: 'critico' },
};
const SEV = {
  critico: { rotulo: 'Urgente', icone: 'triangle-alert' },
  atencao: { rotulo: 'Atenção', icone: 'info' },
  ok: { rotulo: 'Tudo certo', icone: 'circle-check' },
  desconhecido: { rotulo: 'Desconhecido', icone: 'circle-dashed' },
  info: { rotulo: 'Info', icone: 'info' },
};

const NAV = [
  ['layout-dashboard', 'Visão geral', true],
  ['smartphone', 'Aparelhos'],
  ['building-2', 'Lojas e equipes'],
  ['shield-check', 'Políticas'],
  ['layout-grid', 'Aplicativos'],
  ['send', 'Comandos'],
  ['bell', 'Alertas', false, 4],
  ['scroll-text', 'Auditoria'],
  ['settings', 'Configurações'],
];

const pct = (n, t) => Math.round((n / t) * 100);
const fmt = (n) => n.toLocaleString('pt-BR');

// ---------- Componentes compartilhados ----------
const banner = () => `
<div class="banner" role="status">${icon('info', 16)}<strong>DADOS SIMULADOS</strong><span>Protótipo de design — nenhum aparelho real é gerenciado.</span></div>`;

const pill = (tom, rotulo, ic) => `<span class="pill pill-${tom}">${icon(ic, 14)}${rotulo}</span>`;

const barras = (lista, total, titulo) => `
<figure class="chart" aria-label="${titulo}">
  ${lista
    .map(
      (d) => `<div class="bar-row" title="${d.v}: ${d.n} aparelhos (${pct(d.n, total)}%)">
    <span class="bar-label">${d.v}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${(d.n / Math.max(...lista.map((x) => x.n))) * 100}%"></span></span>
    <span class="bar-value">${d.n} <small>${pct(d.n, total)}%</small></span>
  </div>`
    )
    .join('')}
</figure>`;

const tabelaComandos = () => `
<table class="table">
  <thead><tr><th>Ação</th><th>Alvo</th><th>Local</th><th>Estado</th><th>Quando</th></tr></thead>
  <tbody>
  ${D.comandos
    .map((c) => {
      const e = ESTADO_CMD[c.estado];
      return `<tr><td class="strong">${c.acao}</td><td>${c.alvo}</td><td>${c.onde}</td><td>${pill(e.tom, e.rotulo, e.icone)}</td><td class="muted">${c.quando}</td></tr>`;
    })
    .join('')}
  </tbody>
</table>`;

const alertas = (comImpacto = true) => `
<ul class="alerts">
  ${D.alertas
    .map(
      (a) => `<li class="alert alert-${a.sev}">
    <span class="alert-icon">${icon(SEV[a.sev].icone, 18)}</span>
    <div class="alert-body">
      <div class="alert-title">${a.titulo}</div>
      ${comImpacto ? `<div class="alert-impact">${a.impacto}</div>` : ''}
      <div class="alert-meta">${pill(a.sev, SEV[a.sev].rotulo, SEV[a.sev].icone)}<span>${a.onde}</span><span>·</span><span>${a.quando}</span></div>
    </div>
    <span class="alert-go">${icon('chevron-right', 18)}</span>
  </li>`
    )
    .join('')}
</ul>`;

const fonte = () => `<p class="source">${icon('clock', 14)} Atualizado em ${D.atualizado} · origem: <strong>simulador</strong></p>`;

const page = ({ titulo, css, fonts, body, theme }) => `<!doctype html>
<html lang="pt-BR" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<style>
${fonts}
*{box-sizing:border-box;margin:0;padding:0}
body{-webkit-font-smoothing:antialiased}
svg{flex-shrink:0}
ul{list-style:none}
table{border-collapse:collapse;width:100%}
${css}
</style>
</head>
<body>
${body}
</body>
</html>`;

// =====================================================================
// DIREÇÃO A — "Clareza": enterprise minimal, claro, azul confiança, Inter
// =====================================================================
const cssA = `
:root{--bg:#F6F8FB;--surface:#FFFFFF;--surface-2:#F0F3F8;--border:#E1E6EE;--text:#16202E;--text-2:#475467;--muted:#667085;
--primary:#1D5FD1;--primary-soft:#E8F0FD;--ok:#136F35;--ok-soft:#E7F6EC;--warn:#A15C07;--warn-soft:#FDF3E1;--crit:#C0262D;--crit-soft:#FDECEC;--unk:#5B6472;--unk-soft:#EEF0F3;--info:#1D5FD1;--info-soft:#E8F0FD;--bar:#1D5FD1}
body{font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--text);font-size:14px;line-height:1.5}
.app{display:grid;grid-template-columns:248px 1fr;min-height:100vh}
.side{background:var(--surface);border-right:1px solid var(--border);padding:20px 14px;display:flex;flex-direction:column;gap:4px}
.brand{display:flex;align-items:center;gap:10px;padding:4px 8px 20px;font-weight:700;font-size:16px;letter-spacing:-.01em}
.nav a{display:flex;align-items:center;gap:12px;padding:9px 10px;border-radius:8px;color:var(--text-2);text-decoration:none;font-weight:500}
.nav a.on{background:var(--primary-soft);color:var(--primary);font-weight:600}
.nav .badge{margin-left:auto;background:var(--crit);color:#fff;border-radius:999px;font-size:11px;font-weight:700;padding:1px 7px}
.main{display:flex;flex-direction:column;min-width:0}
.top{display:flex;align-items:center;gap:16px;padding:14px 32px;background:var(--surface);border-bottom:1px solid var(--border)}
.search{flex:1;max-width:460px;display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--muted);background:var(--bg)}
.org{margin-left:auto;display:flex;align-items:center;gap:8px;color:var(--text-2);font-weight:500}
.avatar{width:32px;height:32px;border-radius:50%;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:700;font-size:13px}
.banner{display:flex;align-items:center;gap:8px;padding:8px 32px;background:#FFF7E0;color:#7A4B00;border-bottom:1px solid #F3DFA8;font-size:13px}
.content{padding:28px 32px 40px;display:flex;flex-direction:column;gap:24px}
h1{font-size:24px;font-weight:700;letter-spacing:-.02em}
.source{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:13px;margin-top:4px}
.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:16px}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px}
.kpi .k-label{display:flex;align-items:center;gap:8px;color:var(--text-2);font-size:13px;font-weight:500}
.kpi .k-value{font-size:28px;font-weight:700;letter-spacing:-.02em;margin-top:8px}
.kpi .k-hint{color:var(--muted);font-size:12px}
.kpi.crit .k-label svg{color:var(--crit)} .kpi.warn .k-label svg{color:var(--warn)} .kpi.unk .k-label svg{color:var(--unk)} .kpi.ok .k-label svg{color:var(--ok)} .kpi.info .k-label svg{color:var(--info)}
.grid2{display:grid;grid-template-columns:1.4fr 1fr;gap:24px}
.grid3{display:grid;grid-template-columns:1fr 2fr;gap:24px}
.stack{display:flex;flex-direction:column;gap:24px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;min-width:0}
.card h2{font-size:16px;font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.card h2 .link{margin-left:auto;font-size:13px;color:var(--primary);font-weight:500}
.alerts{display:flex;flex-direction:column;gap:10px}
.alert{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--border);border-radius:10px}
.alert-icon{width:32px;height:32px;border-radius:8px;display:grid;place-items:center}
.alert-critico .alert-icon{background:var(--crit-soft);color:var(--crit)} .alert-atencao .alert-icon{background:var(--warn-soft);color:var(--warn)} .alert-desconhecido .alert-icon{background:var(--unk-soft);color:var(--unk)}
.alert-body{flex:1;min-width:0}.alert-title{font-weight:600}.alert-impact{color:var(--text-2);font-size:13px;margin-top:2px}
.alert-meta{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;margin-top:8px}
.alert-go{color:var(--muted);align-self:center}
.pill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:2px 9px 2px 7px;font-size:12px;font-weight:600;white-space:nowrap}
.pill-critico{background:var(--crit-soft);color:var(--crit)} .pill-atencao{background:var(--warn-soft);color:var(--warn)} .pill-ok{background:var(--ok-soft);color:var(--ok)} .pill-desconhecido{background:var(--unk-soft);color:var(--unk)} .pill-info{background:var(--info-soft);color:var(--info)}
.stores{display:flex;flex-direction:column}
.store{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)}
.store:last-child{border-bottom:0}
.store .s-ic{width:36px;height:36px;border-radius:8px;background:var(--surface-2);display:grid;place-items:center;color:var(--text-2)}
.store .s-name{font-weight:600}.store .s-sub{color:var(--muted);font-size:12px}
.store .s-right{margin-left:auto;text-align:right}
.store .s-count{font-weight:600}
.chart{display:flex;flex-direction:column;gap:12px}
.bar-row{display:grid;grid-template-columns:90px 1fr 70px;align-items:center;gap:10px;font-size:13px}
.bar-label{color:var(--text-2)}
.bar-track{height:10px;background:var(--surface-2);border-radius:4px;overflow:hidden}
.bar-fill{display:block;height:100%;background:var(--bar);border-radius:0 4px 4px 0}
.bar-value{font-weight:600;text-align:right}.bar-value small{color:var(--muted);font-weight:500}
.table th{text-align:left;color:var(--muted);font-weight:500;font-size:12px;padding:8px 10px;border-bottom:1px solid var(--border)}
.table td{padding:11px 10px;border-bottom:1px solid var(--border);font-size:13px}
.table tr:last-child td{border-bottom:0}
.strong{font-weight:600}.muted{color:var(--muted)}
`;

const logoA = `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#1D5FD1"/><text x="16" y="21" text-anchor="middle" font-family="Inter" font-weight="700" font-size="13" fill="#fff" letter-spacing="-.5">DW</text></svg>`;

const bodyA = () => `
<div class="app">
  <aside class="side">
    <div class="brand">${logoA}<span>DW Solutions</span></div>
    <nav class="nav">${NAV.map(([ic, l, on, b]) => `<a class="${on ? 'on' : ''}">${icon(ic)}${l}${b ? `<span class="badge">${b}</span>` : ''}</a>`).join('')}</nav>
  </aside>
  <div class="main">
    <header class="top">
      <div class="search">${icon('search', 16)} Buscar aparelho, loja ou pessoa…</div>
      <div class="org">${D.org} ${icon('chevron-down', 16)}<span class="avatar">AD</span></div>
    </header>
    ${banner()}
    <main class="content">
      <div><h1>Visão geral</h1>${fonte()}</div>
      <section class="kpis">
        <div class="kpi"><div class="k-label">${icon('smartphone', 16)}Gerenciados</div><div class="k-value">${D.total}</div><div class="k-hint">aparelhos no total</div></div>
        <div class="kpi ok"><div class="k-label">${icon('circle-check', 16)}Com sinal</div><div class="k-value">${D.comunicou24h}</div><div class="k-hint">nas últimas 24 h</div></div>
        <div class="kpi crit"><div class="k-label">${icon('wifi-off', 16)}Sem sinal</div><div class="k-value">${D.semSinal24h}</div><div class="k-hint">há mais de 24 h</div></div>
        <div class="kpi unk"><div class="k-label">${icon('circle-dashed', 16)}Desconhecido</div><div class="k-value">${D.desconhecido}</div><div class="k-hint">sem leitura ainda</div></div>
        <div class="kpi warn"><div class="k-label">${icon('shield-check', 16)}Fora da política</div><div class="k-value">${D.foraConformidade}</div><div class="k-hint">não conformes</div></div>
        <div class="kpi info"><div class="k-label">${icon('hourglass', 16)}Comandos</div><div class="k-value">${D.aguardandoAparelho}</div><div class="k-hint">aguardando aparelho</div></div>
      </section>
      <section class="grid2">
        <div class="card"><h2>O que precisa da sua atenção <span class="link">Ver todos</span></h2>${alertas()}</div>
        <div class="card"><h2>Lojas e equipes <span class="link">Ver todas</span></h2>
          <ul class="stores">${D.lojas
            .map(
              (l) => `<li class="store"><span class="s-ic">${icon(l.icone, 18)}</span><div><div class="s-name">${l.nome}</div><div class="s-sub">${l.tipo}</div></div>
              <div class="s-right"><div class="s-count">${l.ok}/${l.total} com sinal</div>${pill(l.status, l.resumo, SEV[l.status].icone)}</div></li>`
            )
            .join('')}</ul></div>
      </section>
      <section class="grid3">
        <div class="stack"><div class="card"><h2>Versões do Android</h2>${barras(D.android, D.total, 'Aparelhos por versão do Android')}</div>
        <div class="card"><h2>Fabricantes</h2>${barras(D.fabricantes, D.total, 'Aparelhos por fabricante')}</div></div>
        <div class="card"><h2>Comandos recentes <span class="link">Ver fila</span></h2>${tabelaComandos()}</div>
      </section>
    </main>
  </div>
</div>`;

// =====================================================================
// DIREÇÃO B — "Noturno": tech premium, escuro, violeta + verde-água, Manrope
// =====================================================================
const cssB = `
:root{--bg:#0B1020;--surface:#121A2E;--surface-2:#1A2340;--border:#26304D;--text:#EAEEF8;--text-2:#B4BCD3;--muted:#8C95B0;
--primary:#8B7CFF;--accent:#2DD4BF;--ok:#4ADE80;--warn:#FBBF24;--crit:#F87171;--unk:#A1A9BF;--info:#93A8FF;--bar:#8B7CFF}
body{font-family:Manrope,system-ui,sans-serif;background:var(--bg);color:var(--text);font-size:14px;line-height:1.5}
.app{display:grid;grid-template-columns:76px 1fr;min-height:100vh}
.rail{background:#0E1427;border-right:1px solid var(--border);display:flex;flex-direction:column;align-items:center;gap:6px;padding:18px 0}
.rail .logo{margin-bottom:18px}
.rail a{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;color:var(--muted);position:relative}
.rail a.on{background:linear-gradient(135deg,rgba(139,124,255,.28),rgba(45,212,191,.18));color:#fff;box-shadow:inset 0 0 0 1px rgba(139,124,255,.5)}
.rail .dot{position:absolute;top:8px;right:8px;width:8px;height:8px;border-radius:50%;background:var(--crit);box-shadow:0 0 0 2px #0E1427}
.main{min-width:0;display:flex;flex-direction:column}
.top{display:flex;align-items:center;gap:16px;padding:16px 32px}
.top .title{font-size:22px;font-weight:800;letter-spacing:-.02em}
.search{margin-left:auto;width:340px;display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:12px;padding:9px 12px;color:var(--muted);background:var(--surface)}
.kbd{margin-left:auto;font-size:11px;border:1px solid var(--border);border-radius:6px;padding:0 6px}
.avatar{width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#8B7CFF,#2DD4BF);color:#0B1020;display:grid;place-items:center;font-weight:800;font-size:13px}
.banner{margin:0 32px;display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:10px;background:rgba(251,191,36,.12);color:#FCD679;border:1px solid rgba(251,191,36,.3);font-size:13px}
.content{padding:20px 32px 40px;display:grid;grid-template-columns:2fr 1fr;gap:20px}
.col{display:flex;flex-direction:column;gap:20px;min-width:0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;min-width:0}
.card h2{font-size:15px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.card h2 .link{margin-left:auto;font-size:12px;color:var(--primary);font-weight:600}
.hero{background:radial-gradient(120% 140% at 0% 0%,rgba(139,124,255,.35),transparent 55%),radial-gradient(100% 120% at 100% 100%,rgba(45,212,191,.22),transparent 50%),var(--surface);display:grid;grid-template-columns:auto 1fr;gap:28px;align-items:center}
.ring{width:150px;height:150px;border-radius:50%;background:conic-gradient(var(--accent) 0 ${pct(D.comunicou24h, D.total) * 3.6}deg,var(--surface-2) 0);display:grid;place-items:center}
.ring-in{width:118px;height:118px;border-radius:50%;background:var(--surface);display:grid;place-items:center;text-align:center}
.ring-in b{font-size:30px;font-weight:800;display:block;line-height:1}.ring-in span{font-size:12px;color:var(--text-2)}
.hero h3{font-size:14px;color:var(--text-2);font-weight:600}
.hero .big{font-size:40px;font-weight:800;letter-spacing:-.03em;line-height:1.1}
.hero .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px}
.stat{background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:12px;padding:10px 12px}
.stat .l{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-2)}.stat .v{font-size:22px;font-weight:800}
.stat.crit svg{color:var(--crit)}.stat.unk svg{color:var(--unk)}.stat.warn svg{color:var(--warn)}.stat.info svg{color:var(--info)}
.source{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:12px;margin-top:12px}
.alerts{display:flex;flex-direction:column;gap:10px}
.alert{display:flex;gap:12px;align-items:flex-start;padding:12px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid var(--border)}
.alert-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center}
.alert-critico .alert-icon{background:rgba(248,113,113,.15);color:var(--crit)}.alert-atencao .alert-icon{background:rgba(251,191,36,.14);color:var(--warn)}.alert-desconhecido .alert-icon{background:rgba(161,169,191,.14);color:var(--unk)}
.alert-critico{box-shadow:inset 3px 0 0 var(--crit)}
.alert-body{flex:1;min-width:0}.alert-title{font-weight:700;font-size:13px}.alert-impact{color:var(--text-2);font-size:12px;margin-top:2px}
.alert-meta{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:11px;margin-top:8px;flex-wrap:wrap}
.alert-go{display:none}
.pill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:2px 9px 2px 7px;font-size:11px;font-weight:700;white-space:nowrap;border:1px solid}
.pill-critico{color:var(--crit);border-color:rgba(248,113,113,.4);background:rgba(248,113,113,.1)}.pill-atencao{color:var(--warn);border-color:rgba(251,191,36,.4);background:rgba(251,191,36,.1)}.pill-ok{color:var(--ok);border-color:rgba(74,222,128,.4);background:rgba(74,222,128,.1)}.pill-desconhecido{color:var(--unk);border-color:rgba(161,169,191,.4);background:rgba(161,169,191,.1)}.pill-info{color:var(--info);border-color:rgba(147,168,255,.4);background:rgba(147,168,255,.1)}
.stores{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.store{padding:14px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid var(--border)}
.store .s-top{display:flex;align-items:center;gap:8px;font-weight:700}.store .s-top svg{color:var(--text-2)}
.store .s-meter{height:6px;border-radius:3px;background:var(--surface-2);margin:10px 0 8px;overflow:hidden}
.store .s-meter span{display:block;height:100%;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:0 3px 3px 0}
.store .s-row{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--text-2)}
.chart{display:flex;flex-direction:column;gap:12px}
.bar-row{display:grid;grid-template-columns:86px 1fr 64px;align-items:center;gap:10px;font-size:12px}
.bar-label{color:var(--text-2)}.bar-track{height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden}
.bar-fill{display:block;height:100%;background:var(--bar);border-radius:0 4px 4px 0}
.bar-value{font-weight:700;text-align:right}.bar-value small{color:var(--muted);font-weight:500}
.table th{text-align:left;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:8px 10px;border-bottom:1px solid var(--border)}
.table td{padding:11px 10px;border-bottom:1px solid var(--border);font-size:13px}.table tr:last-child td{border-bottom:0}
.strong{font-weight:700}.muted{color:var(--muted)}
`;

const logoB = `<svg class="logo" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="gb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B7CFF"/><stop offset="1" stop-color="#2DD4BF"/></linearGradient></defs><rect width="40" height="40" rx="12" fill="url(#gb)"/><path d="M7.5 12.5h4a7.5 7.5 0 0 1 0 15h-4z" fill="none" stroke="#0B1020" stroke-width="2.8" stroke-linejoin="round"/><path d="M21.5 13l2.4 14 3.1-9 3.1 9 2.4-14" fill="none" stroke="#0B1020" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const bodyB = () => `
<div class="app">
  <aside class="rail">${logoB}${NAV.map(([ic, l, on, b]) => `<a class="${on ? 'on' : ''}" title="${l}">${icon(ic, 20)}${b ? '<span class="dot"></span>' : ''}</a>`).join('')}</aside>
  <div class="main">
    <header class="top"><div class="title">DW Solutions</div>
      <div class="search">${icon('search', 16)} Buscar… <span class="kbd">Ctrl K</span></div><span class="avatar">AD</span></header>
    ${banner()}
    <main class="content">
      <div class="col">
        <section class="card hero">
          <div class="ring"><div class="ring-in"><div><b>${pct(D.comunicou24h, D.total)}%</b><span>com sinal 24 h</span></div></div></div>
          <div><h3>${D.org}</h3><div class="big">${D.total} aparelhos gerenciados</div>
            <div class="stats">
              <div class="stat crit"><div class="l">${icon('wifi-off', 14)}Sem sinal &gt;24 h</div><div class="v">${D.semSinal24h}</div></div>
              <div class="stat unk"><div class="l">${icon('circle-dashed', 14)}Desconhecido</div><div class="v">${D.desconhecido}</div></div>
              <div class="stat warn"><div class="l">${icon('shield-check', 14)}Fora da política</div><div class="v">${D.foraConformidade}</div></div>
              <div class="stat info"><div class="l">${icon('hourglass', 14)}Aguardando</div><div class="v">${D.aguardandoAparelho}</div></div>
            </div>${fonte()}</div>
        </section>
        <section class="card"><h2>Lojas e equipes <span class="link">Ver todas</span></h2>
          <div class="stores">${D.lojas
            .map(
              (l) => `<div class="store"><div class="s-top">${icon(l.icone, 16)}${l.nome}</div><div class="s-meter"><span style="width:${pct(l.ok, l.total)}%"></span></div>
              <div class="s-row"><span>${l.ok}/${l.total} com sinal</span>${pill(l.status, l.resumo, SEV[l.status].icone)}</div></div>`
            )
            .join('')}</div></section>
        <section class="card"><h2>Comandos recentes <span class="link">Ver fila</span></h2>${tabelaComandos()}</section>
      </div>
      <div class="col">
        <section class="card"><h2>Prioridades <span class="link">Ver alertas</span></h2>${alertas()}</section>
        <section class="card"><h2>Versões do Android</h2>${barras(D.android, D.total, 'Aparelhos por versão do Android')}</section>
        <section class="card"><h2>Fabricantes</h2>${barras(D.fabricantes, D.total, 'Aparelhos por fabricante')}</section>
      </div>
    </main>
  </div>
</div>`;

// =====================================================================
// DIREÇÃO C — "Operação de loja": inteligência operacional amigável,
// claro quente, verde-petróleo + âmbar, Nunito Sans
// =====================================================================
const cssC = `
:root{--bg:#F5F3EE;--surface:#FFFFFF;--surface-2:#EFECE4;--border:#E3DED3;--text:#1E2421;--text-2:#4A524E;--muted:#69716C;
--primary:#0E6E64;--primary-soft:#E0F1EE;--accent:#E39B2D;--ok:#177245;--ok-soft:#E3F3E9;--warn:#9A5A00;--warn-soft:#FCEFD9;--crit:#B42318;--crit-soft:#FCE9E7;--unk:#5E6661;--unk-soft:#ECEDEA;--info:#2457A6;--info-soft:#E6EEFA;--bar:#0E6E64}
body{font-family:'Nunito Sans',system-ui,sans-serif;background:var(--bg);color:var(--text);font-size:15px;line-height:1.5}
.app{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
.side{background:#14332F;color:#D7E5E2;padding:20px 14px;display:flex;flex-direction:column;gap:2px}
.brand{display:flex;align-items:center;gap:10px;padding:4px 8px 22px;font-weight:800;font-size:17px;color:#fff}
.group{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8FB0AA;padding:14px 10px 6px;font-weight:700}
.side a{display:flex;align-items:center;gap:12px;padding:9px 10px;border-radius:10px;color:#D7E5E2;font-weight:600;font-size:14px}
.side a.on{background:#F5F3EE;color:#14332F}
.side .badge{margin-left:auto;background:var(--accent);color:#1E2421;border-radius:999px;font-size:11px;font-weight:800;padding:1px 7px}
.main{min-width:0;display:flex;flex-direction:column}
.banner{display:flex;align-items:center;gap:8px;padding:8px 32px;background:#FFF4D6;color:#6B4400;border-bottom:1px solid #EED9A0;font-size:13px}
.top{display:flex;align-items:center;gap:16px;padding:14px 32px;border-bottom:1px solid var(--border);background:var(--surface)}
.search{flex:1;max-width:480px;display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:999px;padding:8px 16px;color:var(--muted);background:var(--bg)}
.help{margin-left:auto;display:flex;align-items:center;gap:6px;color:var(--primary);font-weight:700}
.avatar{width:34px;height:34px;border-radius:50%;background:var(--accent);color:#1E2421;display:grid;place-items:center;font-weight:800;font-size:13px}
.content{padding:26px 32px 40px;display:flex;flex-direction:column;gap:24px}
.hello h1{font-size:26px;font-weight:800;letter-spacing:-.01em}
.hello p{color:var(--text-2);margin-top:2px}
.source{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:13px;margin-top:6px}
.summary{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.chip{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:6px 14px 6px 10px;font-weight:600;font-size:14px}
.chip b{font-size:16px}
.chip.ok svg{color:var(--ok)}.chip.crit svg{color:var(--crit)}.chip.unk svg{color:var(--unk)}.chip.warn svg{color:var(--warn)}.chip.info svg{color:var(--info)}
.stores{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.store{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;border-top:5px solid var(--ok)}
.store.critico{border-top-color:var(--crit)}.store.atencao{border-top-color:var(--accent)}
.s-top{display:flex;align-items:center;gap:10px}
.s-ic{width:38px;height:38px;border-radius:10px;background:var(--surface-2);display:grid;place-items:center;color:var(--text-2)}
.s-name{font-weight:800;font-size:16px}.s-sub{color:var(--muted);font-size:13px}
.s-big{font-size:30px;font-weight:800;margin:14px 0 0;letter-spacing:-.02em}.s-big small{font-size:14px;color:var(--muted);font-weight:600}
.s-list{margin:8px 0 12px;display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--text-2)}
.s-list li{display:flex;justify-content:space-between}
.s-foot{display:flex;align-items:center;justify-content:space-between}
.s-link{color:var(--primary);font-weight:700;font-size:13px;display:flex;align-items:center}
.grid2{display:grid;grid-template-columns:1.5fr 1fr;gap:24px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:22px;min-width:0}
.card h2{font-size:18px;font-weight:800;margin-bottom:4px;display:flex;align-items:center;gap:8px}
.card .sub{color:var(--muted);font-size:13px;margin-bottom:14px}
.card h2 .link{margin-left:auto;font-size:13px;color:var(--primary);font-weight:700}
.alerts{display:flex;flex-direction:column;gap:12px}
.alert{display:flex;gap:14px;align-items:flex-start;padding:14px;border-radius:12px;background:var(--bg)}
.alert-icon{width:36px;height:36px;border-radius:50%;display:grid;place-items:center}
.alert-critico .alert-icon{background:var(--crit-soft);color:var(--crit)}.alert-atencao .alert-icon{background:var(--warn-soft);color:var(--warn)}.alert-desconhecido .alert-icon{background:var(--unk-soft);color:var(--unk)}
.alert-body{flex:1;min-width:0}.alert-title{font-weight:800}.alert-impact{color:var(--text-2);font-size:14px;margin-top:2px}
.alert-meta{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;margin-top:8px}
.alert-go{align-self:center;color:var(--primary)}
.pill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:2px 10px 2px 7px;font-size:12px;font-weight:700;white-space:nowrap}
.pill-critico{background:var(--crit-soft);color:var(--crit)}.pill-atencao{background:var(--warn-soft);color:var(--warn)}.pill-ok{background:var(--ok-soft);color:var(--ok)}.pill-desconhecido{background:var(--unk-soft);color:var(--unk)}.pill-info{background:var(--info-soft);color:var(--info)}
.side-col{display:flex;flex-direction:column;gap:24px}
.chart{display:flex;flex-direction:column;gap:12px}
.bar-row{display:grid;grid-template-columns:92px 1fr 72px;align-items:center;gap:10px;font-size:14px}
.bar-label{color:var(--text-2)}.bar-track{height:12px;background:var(--surface-2);border-radius:4px;overflow:hidden}
.bar-fill{display:block;height:100%;background:var(--bar);border-radius:0 4px 4px 0}
.bar-value{font-weight:800;text-align:right}.bar-value small{color:var(--muted);font-weight:600}
.table th{text-align:left;color:var(--muted);font-weight:700;font-size:12px;padding:8px 10px;border-bottom:1px solid var(--border)}
.table td{padding:12px 10px;border-bottom:1px solid var(--border);font-size:14px}.table tr:last-child td{border-bottom:0}
.strong{font-weight:700}.muted{color:var(--muted)}
`;

const logoC = `<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><rect x="2" y="2" width="14" height="14" rx="4" fill="#F5F3EE"/><rect x="18" y="2" width="14" height="14" rx="4" fill="#F5F3EE"/><rect x="2" y="18" width="14" height="14" rx="4" fill="#F5F3EE"/><rect x="18" y="18" width="14" height="14" rx="4" fill="#E39B2D"/><path d="M21.5 25l2.4 2.4 4.6-5" fill="none" stroke="#14332F" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const navC = [
  ['Operação', [NAV[0], NAV[2], NAV[1], NAV[6]]],
  ['Gestão', [NAV[3], NAV[4], NAV[5]]],
  ['Segurança', [NAV[7], NAV[8]]],
];

const bodyC = () => `
<div class="app">
  <aside class="side">
    <div class="brand">${logoC}<span>DW Solutions</span></div>
    ${navC
      .map(
        ([g, items]) => `<div class="group">${g}</div>${items.map(([ic, l, on, b]) => `<a class="${on ? 'on' : ''}">${icon(ic)}${l}${b ? `<span class="badge">${b}</span>` : ''}</a>`).join('')}`
      )
      .join('')}
  </aside>
  <div class="main">
    ${banner()}
    <header class="top">
      <div class="search">${icon('search', 16)} Buscar aparelho, loja ou vendedor…</div>
      <div class="help">${icon('circle-help', 18)}Ajuda</div><span class="avatar">AD</span>
    </header>
    <main class="content">
      <div class="hello"><h1>Boa tarde! Veja como estão suas lojas hoje.</h1>
        <p>${D.org}</p>${fonte()}
        <div class="summary">
          <span class="chip">${icon('smartphone', 16)}<b>${D.total}</b> aparelhos</span>
          <span class="chip ok">${icon('circle-check', 16)}<b>${D.comunicou24h}</b> com sinal (24 h)</span>
          <span class="chip crit">${icon('wifi-off', 16)}<b>${D.semSinal24h}</b> sem sinal há +24 h</span>
          <span class="chip unk">${icon('circle-dashed', 16)}<b>${D.desconhecido}</b> desconhecidos</span>
          <span class="chip warn">${icon('shield-check', 16)}<b>${D.foraConformidade}</b> fora da política</span>
          <span class="chip info">${icon('hourglass', 16)}<b>${D.aguardandoAparelho}</b> comandos aguardando</span>
        </div>
      </div>
      <section class="stores">${D.lojas
        .map(
          (l) => `<article class="store ${l.status}"><div class="s-top"><span class="s-ic">${icon(l.icone, 20)}</span><div><div class="s-name">${l.nome}</div><div class="s-sub">${l.tipo}</div></div></div>
          <div class="s-big">${l.ok}<small> de ${l.total} com sinal</small></div>
          <ul class="s-list"><li><span>Sem sinal +24 h</span><b>${l.semSinal}</b></li><li><span>Desconhecido</span><b>${l.desconhecido}</b></li><li><span>Fora da política</span><b>${l.fora}</b></li></ul>
          <div class="s-foot">${pill(l.status, l.resumo, SEV[l.status].icone)}</div></article>`
        )
        .join('')}</section>
      <section class="grid2">
        <div class="card"><h2>Prioridades de hoje <span class="link">Ver todos os alertas</span></h2><p class="sub">Ordenadas pelo impacto na operação das lojas, não só pela quantidade de aparelhos.</p>${alertas()}</div>
        <div class="side-col">
          <div class="card"><h2>Versões do Android</h2><p class="sub">Todos os ${D.total} aparelhos</p>${barras(D.android, D.total, 'Aparelhos por versão do Android')}</div>
          <div class="card"><h2>Fabricantes</h2><p class="sub">Todos os ${D.total} aparelhos</p>${barras(D.fabricantes, D.total, 'Aparelhos por fabricante')}</div>
        </div>
      </section>
      <section class="card"><h2>Comandos recentes <span class="link">Ver fila completa</span></h2><p class="sub">“Confirmado pelo provedor” ainda não significa que o aparelho aplicou — só “Aplicação verificada” confirma.</p>${tabelaComandos()}</section>
    </main>
  </div>
</div>`;

const out = [
  ['direcao-a-clareza.html', 'Direção A — Clareza', cssA, fontFace('Inter', 'inter', 'inter', [400, 500, 600, 700]), bodyA, 'light'],
  ['direcao-b-noturno.html', 'Direção B — Noturno', cssB, fontFace('Manrope', 'manrope', 'manrope', [400, 500, 600, 700, 800]), bodyB, 'dark'],
  ['direcao-c-operacao.html', 'Direção C — Operação de loja', cssC, fontFace('Nunito Sans', 'nunito-sans', 'nunito-sans', [400, 600, 700, 800]), bodyC, 'light'],
];
for (const [file, titulo, css, fonts, body, theme] of out) {
  fs.writeFileSync(path.join(OUT, file), page({ titulo, css, fonts, body: body(), theme }));
  console.log('gerado', file);
}
