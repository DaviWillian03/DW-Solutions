# Estado do Projeto

**Última atualização:** 2026-10-23
**Produto:** DW Solutions
**Fase atual:** **CHECKPOINT 5 concluído** (telas aprovadas) → **Fase C — políticas Vendas/Merchandising e conformidade** (aguardando “pode começar”)
**Código:** Fases A e B completas — login seguro, aparelhos simulados, responsáveis, cadastro por QR de demonstração, worker. 100 testes + 17 E2E.

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
- CHECKPOINT 5 respondido: telas da Fase B aprovadas, estados de comunicação mantidos, amostra de ilustração
  colorida vem com a Fase C, nenhum formato extra de logo. CI da Fase B4 verde.

## Plano executável (fatias pequenas)
| # | Fatia | Entrega verificável | Bloqueada por |
|---|-------|---------------------|---------------|
| 1 | ✅ CHECKPOINT 1 — nome | DW Solutions · acessível · português | — |
| 2 | ✅ CHECKPOINT 2 — visual | Design system v1 + arquivos da marca + protótipo de referência | — |
| 3 | ✅ CHECKPOINT 3 — arquitetura | ADRs 0002–0006 | — |
| 4 | ✅ CHECKPOINT 4 — MVP | Escopo enxuto aprovado | — |
| 5 | ✅ A1 — Esqueleto | Monorepo pnpm, setup do container + hook, API `/health`, CI, Dependabot | — |
| 6 | ✅ A2 — Banco | Drizzle + RLS forçado, empresas, responsáveis, auditoria com cadeia de hash, seed | — |
| 7 | ✅ A3a — Login no backend | Better Auth + TOTP + recuperação, perfis Admin/Leitura, convites, CLI da plataforma | — |
| 7b | ✅ A3b — Telas de login | Next.js: entrar, convite, MFA, chave de acesso, visão geral inicial; 9 E2E | — |
| 8 | ✅ Fase B — Simulador + aparelhos | Simulador, worker, cadastro QR demo, aparelhos, responsáveis, usuários, visão geral | — |
| 9 | ✅ CHECKPOINT 5 | Telas aprovadas | — |
| 10 | Fase C — Políticas | Políticas Vendas e Merchandising, conformidade por aparelho, 2 amostras de ilustração | Aprovação do usuário |

A fatia 5 (esqueleto) pode começar logo após o CHECKPOINT 4.

## Testes executados
Ver `docs/TEST_REPORT.md` (Fases A e B: 100 testes + 17 E2E passando).
