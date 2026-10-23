# DW Solutions

MDM web para colocar **smartphones Android corporativos de vendas e merchandising** sob gerenciamento.
Estado atual: **Fase A (fundação: A1 e A2 prontas)** — modo simulador, nenhum aparelho real é gerenciado.

## Começando (container do Claude Code na nuvem)
O gancho de início de sessão já executa o setup. Para rodar manualmente:

```bash
pnpm setup          # inicia PostgreSQL 16 e Redis 7, cria papéis/bancos, gera .env.local, instala dependências
pnpm db:migrate && pnpm db:seed   # banco de desenvolvimento com empresa fictícia
pnpm test           # testes (usam o banco dw_test, recriado do zero)
pnpm lint && pnpm typecheck
pnpm --filter @dw/api build && pnpm --filter @dw/api start   # API em http://127.0.0.1:3001
curl http://127.0.0.1:3001/health
```

## Estrutura
- `apps/api` — API NestJS 12 (ESM). Hoje: `/health` (PostgreSQL + Redis), logs JSON, ID de correlação.
- `packages/db` — esquema Drizzle, migrações com RLS forçado por empresa, auditoria encadeada, seed.
- `infrastructure/local/setup.sh` — preparação idempotente do ambiente.
- `docs/` — decisões (`PRODUCT_DECISIONS.md`), ADRs, design system, escopo do MVP, estado do projeto.

## Segurança
Sem segredos no Git (`.env.local` é gerado com senhas aleatórias). Dependências com versão exata e
publicadas há pelo menos 7 dias. CI com auditoria de dependências e varredura de segredos.
