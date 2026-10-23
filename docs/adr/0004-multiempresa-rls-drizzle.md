# ADR-0004 — Multiempresa com banco único + Row-Level Security, usando Drizzle

- **Status:** Aceito · **Data:** 2026-10-23 · **Decisões:** CP3-2, CP3-3

## Contexto
Arquitetura deve ser multiempresa desde o início (CP0-1); vazamento entre empresas é o risco mais grave.

## Decisão
- **Banco único PostgreSQL**, coluna `tenant_id` (UUID) obrigatória em toda tabela de dados empresariais,
  índices começando por `tenant_id`.
- **Row-Level Security** com `ENABLE` + `FORCE ROW LEVEL SECURITY` e política
  `tenant_id = current_setting('app.tenant_id', true)::uuid`; sem configuração ⇒ nenhuma linha (fail-closed).
- A API conecta com papel `dw_app` (sem `BYPASSRLS`, sem ser dono das tabelas). Cada requisição autenticada
  abre transação e executa `SET LOCAL app.tenant_id` (e `app.user_id` para auditoria).
- Migrações rodam com papel separado `dw_migrator`; operações de plataforma com papel `dw_platform`, restrito
  às tabelas de plataforma (ver ADR-0005).
- **Drizzle ORM** (+ drizzle-kit para migrações SQL versionadas e revisáveis); políticas RLS declaradas no esquema.
- Escopo por filial é verificado na aplicação (permissões) **e** testado; RLS cobre a fronteira de empresa.

## Consequências
- Toda consulta passa por um helper `withTenant(tx => …)`; consultas fora dele falham por design.
- Testes obrigatórios: leitura/escrita/atualização/exclusão cruzada entre empresas, IDOR por ID, filial não autorizada.
- Drizzle ainda é 0.x: fixar versão e ler notas antes de atualizar.
