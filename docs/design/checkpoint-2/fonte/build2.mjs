// CHECKPOINT 2 — rodada 2: branco como cor principal + tons de azul, menu no topo,
// tema segue o sistema, monograma DW. Gera 2 variações + folha de monogramas.
import fs from 'node:fs';
import path from 'node:path';

const NM = path.resolve('node_modules');
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const b64 = (f) => fs.readFileSync(path.join(NM, '@fontsource/plus-jakarta-sans/files', f)).toString('base64');
const FONTS = [400, 500, 600, 700, 800]
  .map((w) => `@font-face{font-family:'Plus Jakarta Sans';font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64(`plus-jakarta-sans-latin-${w}-normal.woff2`)}) format('woff2');}`)
  .join('\n');

const icon = (name, size = 18) =>
  fs
    .readFileSync(path.join(NM, 'lucide-static/icons', `${name}.svg`), 'utf8')
    .replace(/<!--.*?-->/s, '')
    .replace('width="24"', `width="${size}"`)
    .replace('height="24"', `height="${size}"`)
    .replace('<svg', '<svg aria-hidden="true"')
    .trim();

// ---------- Dados SIMULADOS (idênticos à rodada 1) ----------
const D = {
  org: 'Comercial Exemplo Ltda (fictícia)',
  atualizado: '23/10/2026 às 14:32',
  total: 248, comunicou24h: 231, semSinal24h: 12, desconhecido: 5, foraConformidade: 9, aguardandoAparelho: 3,
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
  android: [ { v: 'Android 12', n: 40 }, { v: 'Android 13', n: 78 }, { v: 'Android 14', n: 96 }, { v: 'Android 15', n: 34 } ],
  fabricantes: [ { v: 'Samsung', n: 152 }, { v: 'Motorola', n: 96 } ],
  comandos: [
    { acao: 'Bloquear tela', alvo: 'Galaxy A25 · PDV 03', onde: 'Loja Centro', estado: 'aguardando', quando: 'há 2 h' },
    { acao: 'Aplicar política “Loja/PDV” v3', alvo: '54 aparelhos', onde: 'Shopping Norte', estado: 'provedor', quando: 'há 40 min' },
    { acao: 'Reiniciar', alvo: 'moto g54 · Coletor 12', onde: 'CD Estoque', estado: 'verificado', quando: 'há 15 min' },
    { acao: 'Instalar Força de Vendas', alvo: '4 aparelhos', onde: 'Equipe Externa', estado: 'falhou', quando: 'há 3 h' },
  ],
};
const ESTADO_CMD = {
  aguardando: { rotulo: 'Aguardando aparelho', icone: 'hourglass', tom: 'desconhecido' },
  provedor: { rotulo: 'Confirmado pelo provedor', icone: 'send', tom: 'info' },
  verificado: { rotulo: 'Aplicação verificada', icone: 'circle-check', tom: 'ok' },
  falhou: { rotulo: 'Falhou', icone: 'circle-x', tom: 'critico' },
};
const SEV = {
  critico: { rotulo: 'Urgente', icone: 'triangle-alert' },
  atencao: { rotulo: 'Atenção', icone: 'info' },
  ok: { rotulo: 'Tudo certo', icone: 'circle-check' },
  desconhecido: { rotulo: 'Desconhecido', icone: 'circle-dashed' },
};
const NAV = ['Visão geral', 'Aparelhos', 'Lojas e equipes', 'Políticas', 'Aplicativos', 'Comandos', 'Alertas', 'Auditoria', 'Configurações'];
const pct = (n, t) => Math.round((n / t) * 100);

// ---------- Monogramas (conceitos em SVG) ----------
const M = {
  selo: (s = 36, id = 's') => `<svg width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A1F4D"/><stop offset="1" stop-color="#1A4FD6"/></linearGradient></defs><rect width="40" height="40" rx="11" fill="url(#${id})"/><rect x="1.5" y="1.5" width="37" height="37" rx="9.5" fill="none" stroke="#8CB4FF" stroke-opacity=".45"/><path d="M8 12.5h4a7.5 7.5 0 0 1 0 15H8z" fill="none" stroke="#fff" stroke-width="2.8" stroke-linejoin="round"/><path d="M21.5 13l2.4 14 3.1-9 3.1 9 2.4-14" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  traco: (s = 36, id = 't') => `<svg width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--mono-a,#0A1F4D)"/><stop offset="1" style="stop-color:var(--mono-b,#2F6BFF)"/></linearGradient></defs><path d="M4 10h5.5a10 10 0 0 1 0 20H4z" fill="none" stroke="url(#${id})" stroke-width="3.4" stroke-linejoin="round"/><path d="M19.5 10.5l3.2 19 4.3-12 4.3 12 3.2-19" fill="none" stroke="url(#${id})" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  circulo: (s = 36) => `<svg width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#1A4FD6"/><circle cx="20" cy="20" r="17.5" fill="none" stroke="#fff" stroke-opacity=".28"/><text x="20" y="25.2" text-anchor="middle" font-family="Plus Jakarta Sans" font-weight="800" font-size="14.5" fill="#fff" letter-spacing="-.6">DW</text><circle cx="31.5" cy="11" r="2.6" fill="#8CB4FF"/></svg>`,
};

// ---------- Tokens: claro e escuro (o tema segue o sistema) ----------
const LIGHT = `--bg:#F6F8FC;--surface:#FFFFFF;--surface-2:#EEF3FD;--border:#DCE4F2;--text:#0A1730;--text-2:#3E4E69;--muted:#5C6B84;
--navy:#0A1F4D;--navy-2:#13306E;--royal:#1A4FD6;--azure:#2F6BFF;--sky:#8CB4FF;--ice:#E9F0FF;--on-royal:#FFFFFF;
--hero-text:#FFFFFF;--hero-sub:#BFD2FA;--hero-card:rgba(255,255,255,.08);--hero-line:rgba(140,180,255,.28);
--ok:#0F7A43;--ok-s:#E4F5EB;--warn:#94560A;--warn-s:#FDF2DE;--crit:#BF2A2A;--crit-s:#FDEBEB;--unk:#566176;--unk-s:#EDF0F4;--info:#1A4FD6;--info-s:#E9F0FF;
--bar:#1A4FD6;--banner-bg:#FFF6DC;--banner-fg:#6E4600;--banner-line:#F0DCA4;--shadow:0 1px 2px rgba(10,23,48,.05),0 8px 24px rgba(10,31,77,.06);--mono-a:#0A1F4D;--mono-b:#2F6BFF`;
const DARK = `--bg:#060D1C;--surface:#0C1730;--surface-2:#122247;--border:#1F3366;--text:#EEF3FF;--text-2:#B9C6E2;--muted:#8E9CBC;
--navy:#0E2152;--navy-2:#0A1A40;--royal:#6E9BFF;--azure:#8FB2FF;--sky:#8CB4FF;--ice:#15295A;--on-royal:#06102A;
--hero-text:#FFFFFF;--hero-sub:#BFD2FA;--hero-card:rgba(255,255,255,.06);--hero-line:rgba(140,180,255,.22);
--ok:#4ADE80;--ok-s:rgba(74,222,128,.12);--warn:#FBBF24;--warn-s:rgba(251,191,36,.12);--crit:#F87171;--crit-s:rgba(248,113,113,.13);--unk:#A6B1C9;--unk-s:rgba(166,177,201,.13);--info:#8FB2FF;--info-s:rgba(143,178,255,.13);
--bar:#6E9BFF;--banner-bg:rgba(251,191,36,.10);--banner-fg:#FCD679;--banner-line:rgba(251,191,36,.28);--shadow:none;--mono-a:#8CB4FF;--mono-b:#FFFFFF`;

const BASE = `
:root{${LIGHT}}
@media (prefers-color-scheme: dark){:root:not([data-theme=light]){${DARK}}}
:root[data-theme=dark]{${DARK}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:var(--bg);color:var(--text);font-size:14.5px;line-height:1.5;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
svg{flex-shrink:0} ul{list-style:none} table{border-collapse:collapse;width:100%}
.top{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:28px;height:68px;padding:0 40px;background:var(--surface);border-bottom:1px solid var(--border)}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:17px;letter-spacing:-.02em;white-space:nowrap}
.brand small{display:block;font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.02em}
.tools{margin-left:auto;display:flex;align-items:center;gap:14px}
.search{display:flex;align-items:center;gap:8px;width:260px;padding:8px 12px;border:1px solid var(--border);border-radius:10px;color:var(--muted);background:var(--bg)}
.kbd{margin-left:auto;font-size:11px;border:1px solid var(--border);border-radius:6px;padding:0 6px;color:var(--muted)}
.org{display:flex;align-items:center;gap:6px;color:var(--text-2);font-weight:600;font-size:13px;white-space:nowrap}
.avatar{width:36px;height:36px;border-radius:50%;background:var(--navy);color:#fff;display:grid;place-items:center;font-weight:700;font-size:13px;box-shadow:0 0 0 2px var(--surface),0 0 0 3.5px var(--sky)}
.banner{display:flex;align-items:center;gap:8px;padding:8px 40px;background:var(--banner-bg);color:var(--banner-fg);border-bottom:1px solid var(--banner-line);font-size:13px}
.wrap{max-width:1440px;margin:0 auto;padding:28px 40px 48px;display:flex;flex-direction:column;gap:24px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:22px;box-shadow:var(--shadow);min-width:0}
.card h2{font-size:16px;font-weight:700;letter-spacing:-.01em;display:flex;align-items:center;gap:8px;margin-bottom:4px}
.card .sub{color:var(--muted);font-size:13px;margin-bottom:16px}
.link{margin-left:auto;font-size:13px;color:var(--royal);font-weight:700}
.source{display:flex;align-items:center;gap:6px;font-size:13px}
.pill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:3px 10px 3px 8px;font-size:12px;font-weight:700;white-space:nowrap}
.pill-critico{background:var(--crit-s);color:var(--crit)}.pill-atencao{background:var(--warn-s);color:var(--warn)}.pill-ok{background:var(--ok-s);color:var(--ok)}.pill-desconhecido{background:var(--unk-s);color:var(--unk)}.pill-info{background:var(--info-s);color:var(--info)}
.stores{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.store{position:relative;overflow:hidden}
.store::before{content:'';position:absolute;inset:0 0 auto 0;height:4px;background:var(--ok)}
.store.critico::before{background:var(--crit)}.store.atencao::before{background:var(--warn)}
.s-top{display:flex;align-items:center;gap:12px}
.s-ic{width:40px;height:40px;border-radius:12px;background:var(--ice);color:var(--royal);display:grid;place-items:center}
.s-name{font-weight:700;font-size:15px}.s-sub{color:var(--muted);font-size:12.5px}
.s-big{font-size:30px;font-weight:800;letter-spacing:-.03em;margin-top:16px}.s-big small{font-size:13px;color:var(--muted);font-weight:600;letter-spacing:0}
.s-meter{height:6px;background:var(--surface-2);border-radius:3px;margin:10px 0 12px;overflow:hidden}
.s-meter span{display:block;height:100%;background:linear-gradient(90deg,var(--navy-2),var(--azure));border-radius:0 3px 3px 0}
.s-list{display:flex;flex-direction:column;gap:5px;font-size:13px;color:var(--text-2);margin-bottom:14px}
.s-list li{display:flex;justify-content:space-between}.s-list b{color:var(--text)}
.grid2{display:grid;grid-template-columns:1.55fr 1fr;gap:24px}
.stack{display:flex;flex-direction:column;gap:24px}
.alerts{display:flex;flex-direction:column;gap:10px}
.alert{display:flex;gap:14px;align-items:flex-start;padding:14px;border-radius:12px;border:1px solid var(--border);background:var(--surface)}
.alert-critico{border-left:4px solid var(--crit)}
.alert-icon{width:36px;height:36px;border-radius:10px;display:grid;place-items:center}
.alert-critico .alert-icon{background:var(--crit-s);color:var(--crit)}.alert-atencao .alert-icon{background:var(--warn-s);color:var(--warn)}.alert-desconhecido .alert-icon{background:var(--unk-s);color:var(--unk)}
.alert-body{flex:1;min-width:0}.alert-title{font-weight:700}.alert-impact{color:var(--text-2);font-size:13.5px;margin-top:2px}
.alert-meta{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;margin-top:8px}
.alert-go{align-self:center;color:var(--royal)}
.chart{display:flex;flex-direction:column;gap:12px}
.bar-row{display:grid;grid-template-columns:92px 1fr 74px;align-items:center;gap:12px;font-size:13.5px}
.bar-label{color:var(--text-2)}.bar-track{height:10px;background:var(--surface-2);border-radius:4px;overflow:hidden}
.bar-fill{display:block;height:100%;background:var(--bar);border-radius:0 4px 4px 0}
.bar-value{font-weight:700;text-align:right}.bar-value small{color:var(--muted);font-weight:600}
.table th{text-align:left;color:var(--muted);font-weight:700;font-size:12px;padding:10px 12px;border-bottom:1px solid var(--border)}
.table td{padding:13px 12px;border-bottom:1px solid var(--border);font-size:13.5px}.table tr:last-child td{border-bottom:0}
.table tbody tr:hover{background:var(--surface-2)}
.strong{font-weight:700}.muted{color:var(--muted)}
`;

// ---------- Componentes ----------
const banner = () => `<div class="banner" role="status">${icon('info', 16)}<strong>DADOS SIMULADOS</strong><span>Protótipo de design — nenhum aparelho real é gerenciado.</span></div>`;
const pill = (tom, rotulo, ic) => `<span class="pill pill-${tom}">${icon(ic, 14)}${rotulo}</span>`;
const fonte = () => `<p class="source">${icon('clock', 14)} Atualizado em ${D.atualizado} · origem: <strong>simulador</strong></p>`;
const barras = (lista, total, t) => `<figure class="chart" aria-label="${t}">${lista
  .map((d) => `<div class="bar-row" title="${d.v}: ${d.n} aparelhos (${pct(d.n, total)}%)"><span class="bar-label">${d.v}</span><span class="bar-track"><span class="bar-fill" style="width:${(d.n / Math.max(...lista.map((x) => x.n))) * 100}%"></span></span><span class="bar-value">${d.n} <small>${pct(d.n, total)}%</small></span></div>`)
  .join('')}</figure>`;
const alertas = () => `<ul class="alerts">${D.alertas
  .map((a) => `<li class="alert alert-${a.sev}"><span class="alert-icon">${icon(SEV[a.sev].icone, 18)}</span><div class="alert-body"><div class="alert-title">${a.titulo}</div><div class="alert-impact">${a.impacto}</div><div class="alert-meta">${pill(a.sev, SEV[a.sev].rotulo, SEV[a.sev].icone)}<span>${a.onde}</span><span>·</span><span>${a.quando}</span></div></div><span class="alert-go">${icon('chevron-right', 18)}</span></li>`)
  .join('')}</ul>`;
const tabela = () => `<table class="table"><thead><tr><th>Ação</th><th>Alvo</th><th>Local</th><th>Estado</th><th>Quando</th></tr></thead><tbody>${D.comandos
  .map((c) => { const e = ESTADO_CMD[c.estado]; return `<tr><td class="strong">${c.acao}</td><td>${c.alvo}</td><td>${c.onde}</td><td>${pill(e.tom, e.rotulo, e.icone)}</td><td class="muted">${c.quando}</td></tr>`; })
  .join('')}</tbody></table>`;
const lojas = () => `<section class="stores">${D.lojas
  .map((l) => `<article class="card store ${l.status}"><div class="s-top"><span class="s-ic">${icon(l.icone, 20)}</span><div><div class="s-name">${l.nome}</div><div class="s-sub">${l.tipo}</div></div></div>
  <div class="s-big">${l.ok}<small> de ${l.total} com sinal</small></div><div class="s-meter"><span style="width:${pct(l.ok, l.total)}%"></span></div>
  <ul class="s-list"><li><span>Sem sinal há +24 h</span><b>${l.semSinal}</b></li><li><span>Desconhecido</span><b>${l.desconhecido}</b></li><li><span>Fora da política</span><b>${l.fora}</b></li></ul>${pill(l.status, l.resumo, SEV[l.status].icone)}</article>`)
  .join('')}</section>`;
const corpo = () => `${lojas()}
  <section class="grid2">
    <div class="card"><h2>Prioridades de hoje <span class="link">Ver todos os alertas</span></h2><p class="sub">Ordenadas pelo impacto na operação das lojas.</p>${alertas()}</div>
    <div class="stack">
      <div class="card"><h2>Versões do Android</h2><p class="sub">Todos os ${D.total} aparelhos</p>${barras(D.android, D.total, 'Aparelhos por versão do Android')}</div>
      <div class="card"><h2>Fabricantes</h2><p class="sub">Todos os ${D.total} aparelhos</p>${barras(D.fabricantes, D.total, 'Aparelhos por fabricante')}</div>
    </div>
  </section>
  <section class="card"><h2>Comandos recentes <span class="link">Ver fila completa</span></h2><p class="sub">“Confirmado pelo provedor” ainda não significa que o aparelho aplicou — só “Aplicação verificada” confirma.</p>${tabela()}</section>`;

const page = (titulo, css, body) => `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${titulo}</title>
<style>${FONTS}${BASE}${css}</style></head>
<body>${body}</body></html>`;

// =====================================================================
// D1 — "Azul Real": topo branco, faixa-herói azul-marinho com KPIs, abas sublinhadas
// =====================================================================
const cssD1 = `
.nav{display:flex;gap:4px;height:100%}
.nav a{display:flex;align-items:center;gap:6px;padding:0 12px;height:100%;color:var(--text-2);font-weight:600;font-size:13.5px;border-bottom:2.5px solid transparent;white-space:nowrap}
.nav a.on{color:var(--royal);border-bottom-color:var(--royal)}
.nav .badge{background:var(--crit);color:#fff;border-radius:999px;font-size:10.5px;font-weight:800;padding:0 6px;line-height:17px}
.hero{background:radial-gradient(90% 160% at 100% 0%,rgba(47,107,255,.45),transparent 60%),linear-gradient(135deg,var(--navy) 0%,var(--navy-2) 100%);color:var(--hero-text);padding:30px 40px 34px;border-bottom:1px solid var(--hero-line)}
.hero-in{max-width:1360px;margin:0 auto}
.hero h1{font-size:30px;font-weight:800;letter-spacing:-.03em}
.hero .who{color:var(--hero-sub);font-weight:600;margin-top:2px}
.hero .source{color:var(--hero-sub);margin-top:4px}
.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-top:24px}
.kpi{background:var(--hero-card);border:1px solid var(--hero-line);border-radius:14px;padding:14px 16px;backdrop-filter:blur(6px)}
.kpi .l{display:flex;align-items:center;gap:7px;color:var(--hero-sub);font-size:12.5px;font-weight:600}
.kpi .v{font-size:30px;font-weight:800;letter-spacing:-.03em;margin-top:6px;line-height:1.1}
.kpi .h{color:var(--hero-sub);font-size:12px}
.kpi.crit .l svg{color:#FF9A9A}.kpi.unk .l svg{color:#C9D3E8}.kpi.warn .l svg{color:#FFD27A}.kpi.ok .l svg{color:#7CF0A8}.kpi.info .l svg{color:var(--sky)}
`;
const bodyD1 = () => `
<header class="top"><div class="brand">${M.selo(36, 'h1')}<div>DW Solutions<small>Gestão de aparelhos Android</small></div></div>
  <nav class="nav">${NAV.slice(0, 7).map((l, i) => `<a class="${i === 0 ? 'on' : ''}">${l}${l === 'Alertas' ? '<span class="badge">4</span>' : ''}</a>`).join('')}<a>Mais ${icon('chevron-down', 14)}</a></nav>
  <div class="tools"><div class="search">${icon('search', 16)} Buscar… <span class="kbd">Ctrl K</span></div><span class="avatar">AD</span></div></header>
${banner()}
<section class="hero"><div class="hero-in">
  <h1>Visão geral</h1><div class="who">${D.org}</div>${fonte()}
  <div class="kpis">
    <div class="kpi"><div class="l">${icon('smartphone', 15)}Gerenciados</div><div class="v">${D.total}</div><div class="h">aparelhos no total</div></div>
    <div class="kpi ok"><div class="l">${icon('circle-check', 15)}Com sinal</div><div class="v">${D.comunicou24h}</div><div class="h">nas últimas 24 h</div></div>
    <div class="kpi crit"><div class="l">${icon('wifi-off', 15)}Sem sinal</div><div class="v">${D.semSinal24h}</div><div class="h">há mais de 24 h</div></div>
    <div class="kpi unk"><div class="l">${icon('circle-dashed', 15)}Desconhecido</div><div class="v">${D.desconhecido}</div><div class="h">sem leitura ainda</div></div>
    <div class="kpi warn"><div class="l">${icon('shield-check', 15)}Fora da política</div><div class="v">${D.foraConformidade}</div><div class="h">não conformes</div></div>
    <div class="kpi info"><div class="l">${icon('hourglass', 15)}Comandos</div><div class="v">${D.aguardandoAparelho}</div><div class="h">aguardando aparelho</div></div>
  </div></div></section>
<main class="wrap">${corpo()}</main>`;

// =====================================================================
// D2 — "Azul Gelo": tudo branco, menu em pílulas, cartão-destaque em degradê azul
// =====================================================================
const cssD2 = `
.nav{display:flex;gap:2px;padding:4px;background:var(--surface-2);border-radius:12px}
.nav a{display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:9px;color:var(--text-2);font-weight:600;font-size:13px;white-space:nowrap}
.nav a.on{background:var(--royal);color:var(--on-royal);box-shadow:0 4px 12px rgba(26,79,214,.25)}
.nav .badge{background:var(--crit);color:#fff;border-radius:999px;font-size:10.5px;font-weight:800;padding:0 6px;line-height:17px}
.head h1{font-size:28px;font-weight:800;letter-spacing:-.03em}
.head .row{display:flex;align-items:flex-end;gap:16px}
.head .who{color:var(--text-2);font-weight:600}
.head .source{color:var(--muted);margin-top:4px}
.kpis{display:grid;grid-template-columns:2fr repeat(4,1fr);gap:16px}
.feature{border-radius:18px;padding:22px 24px;color:#fff;background:radial-gradient(80% 140% at 100% 0%,rgba(140,180,255,.45),transparent 55%),linear-gradient(135deg,#0A1F4D 0%,#1A4FD6 100%);box-shadow:0 12px 30px rgba(26,79,214,.28);position:relative;overflow:hidden}
.feature .l{display:flex;align-items:center;gap:8px;color:#C9DAFF;font-weight:600;font-size:13px}
.feature .v{font-size:40px;font-weight:800;letter-spacing:-.04em;line-height:1.1;margin-top:6px}
.feature .v small{font-size:15px;font-weight:600;color:#C9DAFF;letter-spacing:0}
.feature .meter{height:8px;background:rgba(255,255,255,.18);border-radius:4px;margin:16px 0 8px;overflow:hidden}
.feature .meter span{display:block;height:100%;background:#fff;border-radius:0 4px 4px 0}
.feature .h{color:#DCE7FF;font-size:13px}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:18px;box-shadow:var(--shadow)}
.kpi .ic{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:var(--ice);color:var(--royal)}
.kpi.crit .ic{background:var(--crit-s);color:var(--crit)}.kpi.unk .ic{background:var(--unk-s);color:var(--unk)}.kpi.warn .ic{background:var(--warn-s);color:var(--warn)}
.kpi .v{font-size:30px;font-weight:800;letter-spacing:-.03em;margin-top:12px;line-height:1.1}
.kpi .l{font-weight:700;font-size:13.5px}.kpi .h{color:var(--muted);font-size:12.5px}
`;
const bodyD2 = () => `
<header class="top"><div class="brand">${M.circulo(36)}<div>DW Solutions<small>Gestão de aparelhos Android</small></div></div>
  <nav class="nav">${NAV.slice(0, 7).map((l, i) => `<a class="${i === 0 ? 'on' : ''}">${l}${l === 'Alertas' ? '<span class="badge">4</span>' : ''}</a>`).join('')}<a>Mais ${icon('chevron-down', 14)}</a></nav>
  <div class="tools"><div class="search" style="width:200px">${icon('search', 16)} Buscar… <span class="kbd">Ctrl K</span></div><span class="avatar">AD</span></div></header>
${banner()}
<main class="wrap">
  <div class="head"><h1>Visão geral</h1><div class="who">${D.org}</div>${fonte()}</div>
  <section class="kpis">
    <div class="feature"><div class="l">${icon('smartphone', 16)}Aparelhos gerenciados</div><div class="v">${D.total} <small>· ${D.comunicou24h} com sinal nas últimas 24 h</small></div>
      <div class="meter"><span style="width:${pct(D.comunicou24h, D.total)}%"></span></div><div class="h">${pct(D.comunicou24h, D.total)}% da frota comunicou nas últimas 24 h</div></div>
    <div class="kpi crit"><span class="ic">${icon('wifi-off', 18)}</span><div class="v">${D.semSinal24h}</div><div class="l">Sem sinal</div><div class="h">há mais de 24 h</div></div>
    <div class="kpi unk"><span class="ic">${icon('circle-dashed', 18)}</span><div class="v">${D.desconhecido}</div><div class="l">Desconhecido</div><div class="h">sem leitura ainda</div></div>
    <div class="kpi warn"><span class="ic">${icon('shield-check', 18)}</span><div class="v">${D.foraConformidade}</div><div class="l">Fora da política</div><div class="h">não conformes</div></div>
    <div class="kpi"><span class="ic">${icon('hourglass', 18)}</span><div class="v">${D.aguardandoAparelho}</div><div class="l">Comandos</div><div class="h">aguardando aparelho</div></div>
  </section>
  ${corpo()}
</main>`;

// =====================================================================
// Folha de monogramas
// =====================================================================
const sheet = () => {
  const col = (nome, desc, mk) => { const id = nome.normalize('NFD').replace(/[^A-Za-z0-9]/g, ''); return `<section class="card mono-card"><h2>${nome}</h2><p class="sub">${desc}</p>
    <div class="tiles"><div class="tile light">${mk(96, id + 'L')}</div><div class="tile dark">${mk(96, id + 'D')}</div></div>
    <div class="sizes"><span>${mk(48, id + 'a')}<em>48 px</em></span><span>${mk(32, id + 'b')}<em>32 px</em></span><span>${mk(16, id + 'c')}<em>16 px (favicon)</em></span></div>
    <div class="lockup">${mk(40, id + 'k')}<b>DW Solutions</b></div></section>`; };
  return `<main class="wrap"><div><h1 style="font-size:26px;font-weight:800;letter-spacing:-.02em">Monograma DW — 3 conceitos</h1>
  <p class="source" style="color:var(--muted)">Conceitos em SVG simples para escolha de direção. Não são logotipos finalizados.</p></div>
  <div class="monos">${col('M1 · Selo', 'Quadrado azul-marinho → royal, letras em traço branco, borda fina azul-céu. Funciona bem pequeno.', M.selo)}
  ${col('M2 · Traço contínuo', 'Letras em traço com degradê, sem moldura. Elegante; perde força em 16 px.', M.traco)}
  ${col('M3 · Círculo', 'Círculo azul royal com “DW” em tipografia pesada e ponto azul-céu.', (s) => M.circulo(s))}</div></main>`;
};
const cssSheet = `.monos{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px}.tile{height:150px;border-radius:14px;display:grid;place-items:center;border:1px solid var(--border)}
.tile.light{background:#FFFFFF;--mono-a:#0A1F4D;--mono-b:#2F6BFF}.tile.dark{background:#060D1C;--mono-a:#8CB4FF;--mono-b:#FFFFFF}
.sizes{display:flex;align-items:flex-end;gap:22px;margin:18px 0}.sizes span{display:flex;flex-direction:column;align-items:center;gap:6px}.sizes em{font-style:normal;font-size:11px;color:var(--muted)}
.lockup{display:flex;align-items:center;gap:10px;padding-top:16px;border-top:1px solid var(--border)}.lockup b{font-size:20px;font-weight:800;letter-spacing:-.02em}`;

fs.writeFileSync(path.join(OUT, 'direcao-d1-azul-real.html'), page('Direção D1 — Azul Real', cssD1, bodyD1()));
fs.writeFileSync(path.join(OUT, 'direcao-d2-azul-gelo.html'), page('Direção D2 — Azul Gelo', cssD2, bodyD2()));
fs.writeFileSync(path.join(OUT, 'monogramas-dw.html'), page('Monogramas DW', cssSheet, sheet()));
console.log('ok');

// =====================================================================
// REFERÊNCIA APROVADA (CP2): D2 + monograma M2 + animações expressivas
// (sempre desligadas com "reduzir movimento" do sistema)
// =====================================================================
const ANIM = `
:root{--ease-out:cubic-bezier(.2,.8,.2,1);--dur-1:180ms;--dur-2:320ms;--dur-3:700ms}
@keyframes dw-rise{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
@keyframes dw-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes dw-shine{from{transform:translateX(-120%)}to{transform:translateX(220%)}}
@keyframes dw-pulse{0%,100%{box-shadow:0 0 0 0 rgba(191,42,42,.35)}50%{box-shadow:0 0 0 6px rgba(191,42,42,0)}}
.anim .head,.anim .kpis>*,.anim .store,.anim .grid2>*,.anim .wrap>section.card{animation:dw-rise var(--dur-2) var(--ease-out) both;animation-delay:calc(var(--i,0) * 60ms)}
.anim .bar-fill,.anim .s-meter span,.anim .feature .meter span{transform-origin:left;animation:dw-grow var(--dur-3) var(--ease-out) both;animation-delay:calc(200ms + var(--i,0) * 60ms)}
.anim .feature::after{content:'';position:absolute;inset:0;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.18),transparent);animation:dw-shine 1.6s var(--ease-out) .5s both}
.anim .card,.anim .kpi,.anim .feature{transition:transform var(--dur-1) var(--ease-out),box-shadow var(--dur-1) var(--ease-out),border-color var(--dur-1)}
.anim .card:hover,.anim .kpi:hover{transform:translateY(-2px);border-color:var(--sky);box-shadow:0 10px 30px rgba(26,79,214,.12)}
.anim .alert-critico .alert-icon{animation:dw-pulse 2s ease-in-out 3}
.anim .nav a{transition:background var(--dur-1),color var(--dur-1)}
@media (prefers-reduced-motion: reduce){.anim *,.anim *::before,.anim *::after{animation:none!important;transition:none!important}}
`;
const COUNT_JS = `<script>
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.anim .kpis>*,.anim .store,.anim .grid2>*').forEach((el, i) => el.style.setProperty('--i', i));
  document.querySelectorAll('.anim .bar-fill,.anim .s-meter span').forEach((el, i) => el.style.setProperty('--i', i % 6));
  if (reduce) return;
  document.querySelectorAll('[data-count]').forEach((el) => {
    const end = +el.dataset.count, t0 = performance.now(), dur = 900;
    const tick = (t) => { const k = Math.min(1, (t - t0) / dur); el.firstChild.nodeValue = Math.round(end * (1 - Math.pow(1 - k, 3))).toLocaleString('pt-BR'); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
})();
</script>`;
const refBody = bodyD2()
  .replace(M.circulo(36), M.traco(36, 'ref'))
  .replace(/<div class="v">(\d+)/g, '<div class="v" data-count="$1">$1')
  .replace(/<div class="s-big">(\d+)/g, '<div class="s-big" data-count="$1">$1');
const refPage = page('DW Solutions — Referência visual aprovada', cssD2 + ANIM, `<div class="anim">${refBody}</div>${COUNT_JS}`)
  .replace('</title>', '</title>\n<link rel="icon" href="../../marca/favicon/favicon.svg" type="image/svg+xml">');
fs.writeFileSync(path.join(OUT, 'referencia-aprovada.html'), refPage);
console.log('referência ok');
