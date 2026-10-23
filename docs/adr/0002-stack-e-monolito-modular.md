# ADR-0002 — Stack TypeScript e monólito modular com worker

- **Status:** Aceito · **Data:** 2026-10-23 · **Checkpoint:** CP3 (decisão técnica delegada)

## Contexto
Desenvolvimento por um estudante via Claude Code na nuvem, orçamento R$ 0, frota-alvo até 500 aparelhos,
necessidade de filas para comandos e de fronteiras claras para futura separação. Versões consultadas no
npm em 2026-10-23 (ver `docs/architecture/CHECKPOINT_3_PROPOSTA.md`).

## Decisão
- **TypeScript 6.0.x** em todo o projeto (TS 7 nativo ainda incompatível com `@nestjs/swagger`), Node 22 LTS
  (CI também em 24 LTS). Monorepo **pnpm workspaces**; Turborepo só se houver ganho medido.
- **apps/web:** Next.js 16 (App Router) + React 19, Tailwind CSS 4, componentes Radix, TanStack Query/Table,
  React Hook Form. Chama a API pela mesma origem (`/api` reescrito para o NestJS) — cookies first-party, sem CORS aberto.
- **apps/api:** NestJS 12 (adaptador Express). Se um pacote essencial não suportar 12 na Fase A, usar 11.2 e
  registrar. Validação com **Zod 4** via pipe próprio; OpenAPI com `@nestjs/swagger` + `z.toJSONSchema()`.
- **apps/worker:** aplicação NestJS standalone consumindo filas **BullMQ 6 / Redis 7** (retries com backoff,
  deduplicação por chave de idempotência, fila/ tabela de mensagens mortas).
- Módulos: `auth`, `tenancy`, `access`, `devices`, `policies`, `commands`, `providers`, `audit`, `health`.
  Um módulo não acessa tabelas de outro; comunicação por serviços/eventos internos.
- **packages/contracts** (Zod, tipos, `DeviceManagementProvider`), **packages/db** (esquema, migrações, RLS,
  seeds), **packages/config**. Diretórios só são criados quando tiverem uso.
- Logs JSON com **pino** e correlation ID por requisição; OpenTelemetry na Fase E.
- Testes: **Vitest 5** (unidade/integração com banco real), **Supertest** (API), **Playwright** (E2E).
- Qualidade: ESLint + Prettier + `tsc --noEmit`.

## Consequências
- Um único deploy de API + um worker; separação futura é possível pelas fronteiras de módulo.
- Versões exatas fixadas no `package.json` na Fase A; atualizações via Dependabot com revisão.
- Sem Kafka, Kubernetes, microsserviços ou IA na v1.

## Notas de implementação (Fase B, 2026-10-23)
- `apps/worker` ficou como processo Node + BullMQ **sem NestJS**: só consome filas, não expõe HTTP, e assim
  fica menor e mais simples. Processadores são funções puras testadas (`apps/worker/src/processors.ts`).
- Fila `dw-simulador` com prefixo `dw` (desenvolvimento) ou `dw-test` (testes), tarefas `enroll` e `tick`
  (agendador a cada `SIM_TICK_SECONDS`). Processamento idempotente: mensagens repetidas não duplicam efeitos.
- O worker lista IDs de empresas com o papel `dw_platform` e acessa os dados de cada uma com `dw_app` + RLS.
