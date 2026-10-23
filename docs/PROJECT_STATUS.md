# Estado do Projeto

**Última atualização:** 2026-10-23
**Produto:** DW Solutions
**Fase atual:** CHECKPOINT 4 concluído → **Fase A em andamento** (fundação)
**Código:** Fase A1 concluída (fundação: monorepo, setup do container, API com `/health`, CI).

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
- CHECKPOINT 4 respondido: MVP enxuto para smartphones de vendas e merchandising (≈ 52 pts), perfis Admin e
  Leitura, responsável por aparelho, 5 comandos simulados, QR de demonstração. `docs/product/CHECKPOINT_4_MVP.md`.

## Plano executável (fatias pequenas)
| # | Fatia | Entrega verificável | Bloqueada por |
|---|-------|---------------------|---------------|
| 1 | ✅ CHECKPOINT 1 — nome | DW Solutions · acessível · português | — |
| 2 | ✅ CHECKPOINT 2 — visual | Design system v1 + arquivos da marca + protótipo de referência | — |
| 3 | ✅ CHECKPOINT 3 — arquitetura | ADRs 0002–0006 | — |
| 4 | ✅ CHECKPOINT 4 — MVP | Escopo enxuto aprovado | — |
| 5 | ✅ A1 — Esqueleto | Monorepo pnpm, setup do container + hook, API `/health`, CI, Dependabot | — |
| 6 | A2 — Banco | Drizzle + PostgreSQL com RLS, Tenant/User/Role, migrações, seed sintético | Fatia 5 |
| 7 | A3 — Auth + perfis | Better Auth + TOTP/passkey, sessões, perfis Admin/Leitura no backend, testes | Fatia 6 |
| 8 | B1 — Simulador + aparelhos | `SimulatorProvider`, cadastro com QR demo, lista e página do aparelho | Fatia 7 |
| 9 | CHECKPOINT 5 | Revisão das primeiras telas reais | Fatias 2 e 8 |

A fatia 5 (esqueleto) pode começar logo após o CHECKPOINT 4.

## Testes executados
Ver `docs/TEST_REPORT.md` (Fase A1: 8 testes passando, lint/tipos/build/auditoria OK).
