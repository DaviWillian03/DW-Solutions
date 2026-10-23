# Estado do Projeto

**Última atualização:** 2026-10-23
**Produto:** DW Solutions
**Fase atual:** CHECKPOINT 3 concluído → próximo: **CHECKPOINT 4 — Escopo do MVP**, depois **Fase A**
**Código:** nenhum ainda.

## Feito
- Prompt-mestre salvo em `docs/PROMPT_MESTRE.md`.
- Regras oficiais da AMAPI verificadas (2026-10-23) → `docs/ANDROID_FEASIBILITY.md`.
- CHECKPOINT 0 respondido → `docs/PRODUCT_DECISIONS.md`; rota técnica → `docs/adr/0001-...`.
- Ambiente do container verificado (Node 22, pnpm 10, PostgreSQL 16, Redis 7).
- CHECKPOINT 1 respondido: nome **DW Solutions**, posicionamento acessível, tudo em português
  (pesquisa em `docs/naming/CHECKPOINT_1_NOMES.md`).
- CHECKPOINT 2 respondido: branco + azuis (D2 Azul Gelo), Plus Jakarta Sans, menu no topo, tema do
  sistema, monograma M2 (M1 no favicon), animações expressivas, sem slogan, ilustrações coloridas.
  Design system v1 em `docs/design/DESIGN_SYSTEM.md`; marca em `docs/design/marca/`.
- CHECKPOINT 3 respondido: Better Auth (TOTP + passkey), banco único + RLS, Drizzle, plataforma sem acesso
  a dados de clientes, empresas criadas pela plataforma, região no CP8. ADRs 0002–0006.

## Plano executável (fatias pequenas)
| # | Fatia | Entrega verificável | Bloqueada por |
|---|-------|---------------------|---------------|
| 1 | ✅ CHECKPOINT 1 — nome | DW Solutions · acessível · português | — |
| 2 | ✅ CHECKPOINT 2 — visual | Design system v1 + arquivos da marca + protótipo de referência | — |
| 3 | ✅ CHECKPOINT 3 — arquitetura | ADRs 0002–0006 | — |
| 4 | CHECKPOINT 4 — MVP | Backlog MoSCoW e critérios de aceite | Fatia 3 |
| 5 | A1 — Esqueleto | Monorepo pnpm, lint/typecheck/test, CI, script de setup do container | Fatia 3 |
| 6 | A2 — Banco | Drizzle + PostgreSQL com RLS, Tenant/User/Role, migrações, seed sintético | Fatia 5 |
| 7 | A3 — Auth + RBAC | Better Auth + TOTP/passkey, sessões, permissões no backend, testes de isolamento RLS | Fatia 6 |
| 8 | B1 — Simulador + inventário | `SimulatorProvider`, 100–500 aparelhos, listagem paginada | Fatia 7 |
| 9 | CHECKPOINT 5 | Revisão das primeiras telas reais | Fatias 2 e 8 |

A fatia 5 (esqueleto) pode começar logo após o CHECKPOINT 4.

## Testes executados
Ainda não há código do produto. Verificações dos protótipos de design (2026-10-23, Chromium headless):
- Fontes carregadas em todas as páginas; sem rolagem horizontal em 1440 px; sem erros de JavaScript.
- Contraste WCAG: todos os textos ≥ 4,5:1 nos temas claro e escuro (`docs/design/checkpoint-2/fonte/contraste-rodada-2.txt`).
- “Reduzir movimento”: animações desligadas e números exibidos no valor final.
- `favicon.ico` validado (3 imagens: 16, 32, 48 px).
- **NÃO EXECUTADO:** testes de responsividade no celular e leitor de tela (ficam para a Fase A/CP5).
