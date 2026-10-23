# CHECKPOINT 2 — Direções visuais (2026-10-23)

Três protótipos da **mesma tela** (Visão geral), com os **mesmos dados simulados**, para comparação justa.
Arquivos em `docs/design/checkpoint-2/`: HTML autocontido (abre offline no navegador) + captura PNG 1440 px.
Regerar: `node fonte/build.mjs <saida>` e `node fonte/shot.mjs <saida> <saida>` (requer `@fontsource/*`,
`lucide-static`, `playwright-core`).

Princípios aplicados nas três (vêm do prompt-mestre, não são opcionais):
- Faixa **“DADOS SIMULADOS”** sempre visível; carimbo “Atualizado em … · origem: simulador”.
- “Desconhecido” tem cor e ícone próprios — **não** é “sem sinal” nem “perdido”.
- Comandos mostram estados distintos: *Aguardando aparelho* → *Confirmado pelo provedor* →
  *Aplicação verificada* (ou *Falhou*).
- Alertas priorizados por **impacto operacional** (ex.: caixas parados), com texto de “o que fazer”.
- Status sempre com **ícone + rótulo**, nunca só cor. Gráficos de série única, uma cor, valor e %.
- Contraste WCAG AA verificado por script (`fonte/contraste-resultado.txt`): todos os pares ≥ 4,5:1.

## Direção A — “Clareza” (enterprise minimal)
- **Sensação:** limpo, neutro, confiável. Lembra ferramentas corporativas modernas.
- **Tema:** claro. **Navegação:** barra lateral clara com rótulos.
- **Paleta:** fundo `#F6F8FB` · superfície `#FFFFFF` · texto `#16202E` · secundário `#475467` ·
  primária `#1D5FD1` · sucesso `#136F35` · atenção `#A15C07` · crítico `#C0262D` · desconhecido `#5B6472`.
- **Tipografia:** Inter (SIL OFL 1.1 — uso comercial livre).
- **Densidade:** média. KPIs em 6 cartões, alertas + lojas lado a lado, gráficos e fila embaixo.
- **Logo (conceito):** monograma “DW” em quadrado arredondado azul.
- **Prós:** muito legível, fácil de manter, envelhece bem. **Contras:** pouca personalidade.

## Direção B — “Noturno” (tech premium)
- **Sensação:** sofisticado, “produto de tecnologia de ponta”.
- **Tema:** escuro. **Navegação:** trilho de ícones recolhido (rótulo ao passar o mouse) + busca `Ctrl K`.
- **Paleta:** fundo `#0B1020` · superfície `#121A2E` · texto `#EAEEF8` · secundário `#B4BCD3` ·
  primária `#8B7CFF` (violeta) · destaque `#2DD4BF` (verde-água) · sucesso `#4ADE80` · atenção `#FBBF24` ·
  crítico `#F87171` · desconhecido `#A1A9BF`.
- **Tipografia:** Manrope (SIL OFL 1.1).
- **Densidade:** média-alta. Cartão-herói com anel de “% com sinal”, lojas em grade, prioridades à direita.
- **Logo (conceito):** “DW” desenhado em traço sobre quadrado com degradê violeta → verde-água.
- **Prós:** impacto visual em demonstrações. **Contras:** menos “acessível”; ícones sem rótulo exigem
  aprendizado; tema escuro cansa em uso diurno no escritório/loja.

## Direção C — “Operação de loja” (inteligência operacional amigável)
- **Sensação:** acolhedora e prática — fala a língua da **loja**, não da TI.
- **Tema:** claro quente. **Navegação:** barra lateral verde-petróleo, agrupada em Operação/Gestão/Segurança.
- **Paleta:** fundo `#F5F3EE` · superfície `#FFFFFF` · texto `#1E2421` · secundário `#4A524E` ·
  primária `#0E6E64` (verde-petróleo) · destaque `#E39B2D` (âmbar) · sucesso `#177245` · atenção `#9A5A00` ·
  crítico `#B42318` · desconhecido `#5E6661` · informação `#2457A6` · lateral `#14332F`.
- **Tipografia:** Nunito Sans (SIL OFL 1.1) — formas arredondadas, amigáveis, ótima leitura.
- **Densidade:** equilibrada, fonte base 15 px. Saudação em linguagem simples, resumo em “chips”, um
  cartão por loja com faixa de cor de status, prioridades com explicação do impacto.
- **Logo (conceito):** 4 blocos (aparelhos organizados), um em âmbar com “✓”. Evita olho/câmera.
- **Prós:** melhor encaixe com o posicionamento **acessível** e com o público (varejo, lojas, PDV);
  destaca o diferencial (impacto na operação). **Contras:** visual menos “genérico SaaS”; cartões por
  loja precisam de outro formato quando houver muitas lojas (lista com filtro).

## Recomendação
**Direção C**, com a **tabela e a disciplina de espaçamento da A** e **tema escuro opcional** derivado
dela (validado separadamente, não inversão automática). Motivo: o CP1 definiu marca *acessível* e o
público são empresas de varejo sem TI grande; C explica a situação em termos de loja e caixa.

## Ainda não decidido (perguntas do CHECKPOINT 2)
Direção, tema, estilo do logotipo, navegação, densidade, animações, ilustrações, slogan.
Os logos acima são **conceitos em SVG simples**, não logotipos profissionais finalizados.
