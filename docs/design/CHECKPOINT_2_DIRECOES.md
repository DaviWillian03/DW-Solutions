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

## Rodada 2 — Branco + azuis (pedido do usuário)
Decididos: tema segue o sistema · monograma DW · menu no topo. Arquivos em `checkpoint-2/rodada-2/`
(HTML com claro/escuro automático + PNG claro e escuro). Contraste: `fonte/contraste-rodada-2.txt`.

**Tokens comuns (claro):** fundo `#F6F8FC` · superfície `#FFFFFF` · gelo `#E9F0FF` · borda `#DCE4F2` ·
texto `#0A1730` · secundário `#3E4E69` · apagado `#5C6B84` · marinho `#0A1F4D` · marinho-2 `#13306E` ·
royal `#1A4FD6` (ação principal) · azure `#2F6BFF` (degradês) · céu `#8CB4FF` (detalhes).
**Escuro:** fundo `#060D1C` · superfície `#0C1730` · texto `#EEF3FF` · royal `#6E9BFF`.
**Status (reservados, sempre com ícone + rótulo):** sucesso `#0F7A43` · atenção `#94560A` ·
crítico `#BF2A2A` · desconhecido `#566176` · informação = royal.
**Tipografia:** Plus Jakarta Sans (SIL OFL 1.1), números tabulares.

- **D1 · Azul Real:** topo branco com abas sublinhadas; **faixa-herói azul-marinho** com os 6 indicadores
  em cartões translúcidos; resto em branco. Mais contraste e sensação de luxo; o azul ocupa mais espaço.
- **D2 · Azul Gelo:** **tudo branco**, menu em pílulas com aba ativa royal; um **cartão-destaque em
  degradê marinho → royal** com total e % com sinal; demais indicadores em cartões brancos. Branco
  domina, azul como acento. **Recomendada**, por seguir à risca “cor principal branca”.
- **Monogramas:** M1 Selo (quadrado marinho → royal, legível até 16 px — recomendado) · M2 Traço
  contínuo (elegante, fraco em 16 px) · M3 Círculo (forte, mas “DW” some em 16 px).

## Ainda não decidido (perguntas do CHECKPOINT 2)
Variação D1/D2, monograma M1/M2/M3, densidade, animações, ilustrações, slogan.
Os logos acima são **conceitos em SVG simples**, não logotipos profissionais finalizados.
