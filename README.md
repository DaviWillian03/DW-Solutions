# DW Solutions

MDM web para colocar **smartphones Android corporativos de vendas e merchandising** sob gerenciamento.
Estado atual: **Fases A e B concluídas** — login seguro e gestão de aparelhos **simulados**; próximo: políticas (Fase C) — modo simulador, nenhum aparelho real é gerenciado.

## Começando (container do Claude Code na nuvem)
O gancho de início de sessão já executa o setup. Para rodar manualmente:

```bash
pnpm setup          # inicia PostgreSQL 16 e Redis 7, cria papéis/bancos, gera .env.local, instala dependências
pnpm db:migrate && pnpm db:seed   # empresa fictícia + 250 aparelhos simulados
pnpm dev:worker                   # simulador (cadastro por QR e check-ins)
pnpm test           # testes (usam o banco dw_test, recriado do zero)
pnpm lint && pnpm typecheck
pnpm --filter @dw/api build && pnpm --filter @dw/api start   # API em http://127.0.0.1:3001
curl http://127.0.0.1:3001/health
pnpm --filter @dw/web dev        # site em http://localhost:3000
pnpm platform convidar-admin --slug comercial-exemplo --admin-nome "Seu Nome" --admin-email voce@exemplo.test
pnpm e2e                         # testes de navegador
```

## Estrutura
- `apps/web` — site Next.js 16 (entrar, convite, verificação em duas etapas, chave de acesso, visão geral).
- `apps/api` — API NestJS 12 (ESM): Better Auth, perfis, convites, auditoria, `/health`.
- `apps/worker` — worker do simulador (BullMQ).
- `packages/contracts` — contrato do provedor de gerenciamento e da fila.
- `packages/simulator` — frota sintética, ciclo de check-ins, cadastro simulado.
- `packages/db` — esquema Drizzle, migrações com RLS forçado por empresa, auditoria encadeada, seed.
- `infrastructure/local/setup.sh` — preparação idempotente do ambiente.
- `docs/` — decisões (`PRODUCT_DECISIONS.md`), ADRs, design system, escopo do MVP, estado do projeto.

## Segurança
Sem segredos no Git (`.env.local` é gerado com senhas aleatórias). Dependências com versão exata e
publicadas há pelo menos 7 dias. CI com auditoria de dependências e varredura de segredos.
