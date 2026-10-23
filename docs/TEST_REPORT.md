# Relatório de testes

Formato: data · fatia · ambiente · comandos · resultado · falhas conhecidas. Só registra o que foi executado.

## 2026-10-23 · Fase A1 (fundação) · container Claude Code (Linux, Node 22.22.0, pnpm 10.28.0, PostgreSQL 16.15, Redis 7.0.15)

| Comando | Resultado |
|---------|-----------|
| `bash infrastructure/local/setup.sh` (1ª execução, cluster novo) | ✅ cluster criado, PostgreSQL e Redis iniciados, `.env.local` gerado |
| `SKIP_INSTALL=1 bash infrastructure/local/setup.sh` (2ª execução) | ✅ idempotente, senhas reaproveitadas |
| Serviços parados + `.claude/hooks/session-start.sh` | ✅ reiniciou PostgreSQL e Redis; teste de health passou em seguida |
| `psql $DATABASE_URL -c "select rolbypassrls …"` | ✅ `dw_app` com `rolbypassrls = f` |
| `pnpm test` | ✅ 2 arquivos, **8 testes passaram** |
| `pnpm typecheck` | ✅ sem erros |
| `pnpm lint` / `pnpm format:check` | ✅ sem problemas |
| `pnpm --filter @dw/api build` + execução real + `curl /health` | ✅ `200 {"status":"ok", database up, redis up}` |
| `pnpm audit --audit-level high` | ✅ nenhuma vulnerabilidade conhecida |

**Testes cobertos:** configuração válida/ inválida sem vazar senha; `/health` 200 com dependências reais;
503 com Redis indisponível e com senha errada do banco, sem detalhes do erro na resposta; ID de correlação
gerado, reaproveitado só se seguro e recusado para valores maliciosos; cabeçalho `x-powered-by` ausente.

**NÃO EXECUTADO nesta fatia:** CI no GitHub (roda após o push), testes de carga, E2E de navegador (não há telas ainda).
