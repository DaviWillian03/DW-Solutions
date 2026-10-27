# Estado do Projeto

**Última atualização:** 2026-10-25
**Produto:** DW Solutions
**Fase atual:** **Rota Intune** (B-4) — MVP completo no simulador; conector `@dw/intune` pronto e desligado (I1, ADR-0010); Localizar + Tocar som no lugar do modo perdido (I2). Próximo: I3 (sincronização). Aparelho real aguarda o plano 365 (R-3: Intune só se já incluído — gasto extra fora de cogitação, R-1) e app no Entra (I-4)
**Código:** Fases A–D completas — login seguro, aparelhos simulados, responsáveis, cadastro por QR de demonstração, worker, políticas versionadas e conformidade, comandos com estados verificáveis e aprovação dupla, auditoria na tela. 181 testes + 28 E2E.

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
- Fase C: políticas Vendas e Merchandising versionadas (ADR-0007), simulação de impacto antes de publicar,
  conflito em vez de sobrescrita, troca em lote, conformidade com motivo/como resolver/horário, 2 ilustrações.
- Fase D: comandos com estados verificáveis (ADR-0008), apagar desligado por padrão, 1 aparelho com nome + MFA,
  vários com 2º admin, refazer MFA com limite e uso único, aparelho que volta depois do prazo não executa.

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
| 10 | ✅ Fase C — Políticas | C1 modelo + banco + simulador · C2 API · C3 telas, ilustrações e E2E | — |
| 11 | ✅ Fase D — Comandos | D1 banco/simulador/worker · D2 API (aprovação dupla, refazer MFA) · D3 telas e E2E | — |
| 12 | ✅ Fase E — Auditoria | Lista com filtros, tentativas negadas, verificação da cadeia | — |
| 13 | ✅ CHECKPOINT 6 / F0 | Conector `@dw/amapi` desligado, trava contra apagamento automático (ADR-0009) | — |
| 13b | ✅ Revisão geral | Acessibilidade AA automática (0 falhas) e celular 390 px em 11 telas | — |
| 13c | ✅ Estudo rota B | MDMs de terceiros comparados; empresa usa Microsoft 365 → Intune candidato | — |
| 14 | ✅ Decisão B-4 | Provedor real = Microsoft Intune (uso interno); pesquisa `docs/android/INTUNE.md` | — |
| 15 | ✅ Intune I1 | `@dw/intune` desligado: comandos, inventário, estado das ações, perfil com travas, cadastro, grupos (18 testes sem rede) | — |
| 16 | ✅ Intune I2 | Localizar (só admin, motivo + MFA, só quem pediu vê, coordenadas não guardadas) + Tocar som; modo perdido não é mais oferecido; “Sem política” na visão geral | — |
| 17 | Intune I3 | Sincronização com o Intune (worker) e modo real na tela | I2 |
| 18 | Intune I4 | Laboratório no aparelho Samsung/Motorola | Licença (I-3) + app no Entra (I-4) |

A fatia 5 (esqueleto) pode começar logo após o CHECKPOINT 4.

## Testes executados
Ver `docs/TEST_REPORT.md` (212 testes + 30 E2E passando).

## Como retomar
1. Ler `docs/OPEN_QUESTIONS.md` (pendências da empresa) e `docs/android/` (CP6 e rota B).
2. Rota decidida: **Intune** (ADR-0010). Seguir a fatia I3 (sincronização); o laboratório (I4) só com licença e app
   no Entra confirmados.
3. Pendência com data: **2026-10-29** atualizar body-parser/multer e remover a exceção de auditoria.
