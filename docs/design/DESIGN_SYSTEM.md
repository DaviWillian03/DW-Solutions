# Design System — DW Solutions (v1, aprovado no CHECKPOINT 2 em 2026-10-23)

Referência visual: `docs/design/checkpoint-2/rodada-2/referencia-aprovada.html` (abre offline; claro/escuro
automático; animações). Capturas: `referencia-aprovada-claro.png`, `-escuro.png`, `-animando.png`.
Arquivos da marca: `docs/design/marca/`. Decisões: CP2-1 a CP2-12 em `docs/PRODUCT_DECISIONS.md`.

## 1. Princípios
1. **Branco é a cor principal**; azuis complementam. Luxo vem do contraste marinho × branco, não de excesso.
2. **Tudo visível:** todo texto ≥ 4,5:1 (WCAG AA) nos dois temas — verificado por script, não a olho.
3. **Acessível na linguagem:** frases curtas, termos técnicos com explicação.
4. **Verdade dos dados:** origem + horário em toda informação sincronizada; “Desconhecido” ≠ “Sem sinal”;
   estados de comando distintos; faixa “DADOS SIMULADOS” em modo simulador.
5. **Status nunca só por cor:** sempre ícone + rótulo.

## 2. Cores (tokens)
| Token | Claro | Escuro | Uso |
|-------|-------|--------|-----|
| `--bg` | `#F6F8FC` | `#060D1C` | fundo da página |
| `--surface` | `#FFFFFF` | `#0C1730` | cartões, topo |
| `--surface-2` | `#EEF3FD` | `#122247` | trilhos, hover, menu em pílulas |
| `--border` | `#DCE4F2` | `#1F3366` | bordas |
| `--text` | `#0A1730` | `#EEF3FF` | texto principal |
| `--text-2` | `#3E4E69` | `#B9C6E2` | texto secundário |
| `--muted` | `#5C6B84` | `#8E9CBC` | legendas, horários |
| `--navy` | `#0A1F4D` | `#0E2152` | marinho (destaques de luxo) |
| `--navy-2` | `#13306E` | `#0A1A40` | marinho secundário |
| `--royal` | `#1A4FD6` | `#6E9BFF` | ação principal, links, aba ativa |
| `--on-royal` | `#FFFFFF` | `#06102A` | texto sobre royal |
| `--azure` | `#2F6BFF` | `#8FB2FF` | degradês (decorativo) |
| `--sky` | `#8CB4FF` | `#8CB4FF` | brilhos, foco, detalhes |
| `--ice` | `#E9F0FF` | `#15295A` | fundo de ícones/destaques |

**Status (reservados — nunca usar como cor de série de gráfico):**
| Status | Claro (texto / fundo) | Escuro (texto / fundo) |
|--------|-----------------------|------------------------|
| Sucesso / verificado | `#0F7A43` / `#E4F5EB` | `#4ADE80` / 12% |
| Atenção | `#94560A` / `#FDF2DE` | `#FBBF24` / 12% |
| Crítico / urgente / falhou | `#BF2A2A` / `#FDEBEB` | `#F87171` / 13% |
| Desconhecido / aguardando | `#566176` / `#EDF0F4` | `#A6B1C9` / 13% |
| Informação / confirmado pelo provedor | `#1A4FD6` / `#E9F0FF` | `#8FB2FF` / 13% |

Faixa de simulação: `#6E4600` sobre `#FFF6DC` (claro) · `#FCD679` sobre âmbar 10% (escuro).
**Degradê de destaque:** `linear-gradient(135deg, #0A1F4D, #1A4FD6)` + brilho radial `#8CB4FF` 45%.

## 3. Tipografia
- **Plus Jakarta Sans** (SIL OFL 1.1, uso comercial livre), pesos 400–800, números tabulares.
- Escala: título de página 28/800 · título de cartão 16/700 · corpo 14,5/400 · legenda 12–13/500–600 ·
  número de destaque 30–40/800 com `letter-spacing:-.03em`.

## 4. Layout e navegação
- **Menu no topo** (altura 68 px): monograma + nome, abas em **pílulas** (ativa em royal), “Mais ▾” para
  Auditoria e Configurações, busca `Ctrl K`, avatar. Em telas estreitas: botão “☰”.
- Largura máxima 1440 px, margens 40 px (16 px no celular), espaçamento entre blocos 24 px.
- Cartões: raio 16–18 px, borda 1 px, sombra leve só no tema claro.
- **Densidade equilibrada** (CP2-7). Preparar tokens para um modo compacto futuro em tabelas.

## 5. Movimento — expressivo (CP2-8)
- Tokens: `--dur-1:180ms` (hover) · `--dur-2:320ms` (entrada) · `--dur-3:700ms` (crescimento de barras) ·
  curva `cubic-bezier(.2,.8,.2,1)`.
- Entrada em cascata dos cartões (60 ms entre itens), números contando até o valor, barras crescendo,
  brilho único no cartão de destaque, elevação no hover, pulso (3×) no ícone de alerta urgente.
- **Obrigatório:** `prefers-reduced-motion: reduce` desliga toda animação (testado no protótipo).
- **Proibido:** animação que sugira sucesso antes da confirmação real (ex.: check animado em
  “Confirmado pelo provedor”); animações em loop infinito; atrasar a leitura de dados críticos.

## 6. Marca
| Uso | Arquivo |
|-----|---------|
| Monograma principal (M2 · Traço contínuo) | `marca/svg/dw-monograma-claro.svg`, `-escuro.svg` |
| Assinatura horizontal (monograma + nome em curvas) | `marca/svg/dw-assinatura-claro.svg`, `-escuro.svg` |
| PNG | `marca/png/` (monograma 512 px, assinatura 8×) |
| Ícone pequeno (M1 · Selo) — CP2-10 | `marca/svg/dw-selo.svg` |
| Favicon | `marca/favicon/favicon.ico` (16/32/48), `favicon.svg`, PNGs, `apple-touch-icon-180.png` |
| Ícone de app (PWA, maskable) | `marca/app/icone-app-192.png`, `-512.png`, `manifest.exemplo.json` |

- **Sem slogan** (CP2-9). Nome sempre “DW Solutions”.
- Respiro mínimo ao redor do monograma: ¼ da altura. Não aplicar o M2 abaixo de 24 px — usar o M1.
- Os arquivos são **conceitos originais em SVG simples**, não um trabalho de designer profissional.
  Antes de uso comercial: revisão por designer e busca de marca no INPI.

## 7. Ilustrações — coloridas (CP2-11)
- Estilo **aprovado** (C-1, 2026-10-23) a partir das amostras da Fase C: **A1** “política sem aparelhos” e **A2** “nenhum aparelho fora da
  política” em `apps/web/components/illustrations.tsx` (SVG em linha, cores pelos tokens, flutuação suave
  desligada com “reduzir movimento”). Capturas: `docs/design/telas-c/07`–`09`.
- Acento quente `--warm` (#FF9B54 claro / #FFB27D escuro) só para decoração das ilustrações.
- Restrições: paleta derivada dos azuis + um acento quente; sem cores de status como decoração;
  nada que remeta a vigilância (olhos, câmeras, lupas sobre pessoas).

## 8. Gráficos
- Série única: uma cor (`--bar` = royal), valor + % à direita, trilho `--surface-2`, ponta arredondada 4 px.
- Mais de uma série: paleta categórica será validada com `validate_palette.js` antes do uso.
- Toda visualização tem alternativa em tabela e tooltip ao passar o mouse.

## 9. Como regerar
`docs/design/checkpoint-2/fonte/`: `build2.mjs` (protótipos), `logo-assets.mjs` (marca),
`contrast2.py` (contraste). Dependências: `@fontsource/plus-jakarta-sans`, `lucide-static` (ISC),
`opentype.js`, `playwright-core`.
