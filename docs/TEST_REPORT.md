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

### CI no GitHub — Fase A1 (commit `eea6f4a`)
✅ Run [#1](https://github.com/DaviWillian03/DW-Solutions/actions/runs/39967281577): “Lint, tipos e testes” em
Node 22 e Node 24 + “Segurança da cadeia de suprimentos” (pnpm audit + gitleaks) — todos com sucesso.

## 2026-10-23 · Fase A2 (banco com RLS e auditoria) · mesmo ambiente

| Comando | Resultado |
|---------|-----------|
| `pnpm db:migrate` (dw_dev) | ✅ migrações 0000 e 0001 aplicadas com `dw_migrator` |
| `pnpm db:seed` (2×) | ✅ empresa fictícia + 12 responsáveis; 2ª execução não duplica |
| `psql $DATABASE_URL` sem empresa definida | ✅ `0` responsáveis visíveis (fail-closed) |
| mesma consulta com `app.tenant_id` da empresa | ✅ `12` visíveis; `audit_verify_chain()` com `0` problemas |
| `pnpm test` (raiz, pacotes em sequência) | ✅ **29 testes**: API 8 + banco 21 |
| `pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm format:check` | ✅ |

**Testes do banco (`packages/db/test`), sempre com banco recriado do zero:**
- RLS: sem empresa ⇒ nada visível; cada empresa vê só o seu; IDOR por ID; UPDATE em outra empresa não altera;
  INSERT/UPDATE com `tenant_id` alheio recusado; DELETE proibido (exclusão segura); app não cria empresa,
  não desliga RLS nem troca de papel; `tenantId` malicioso recusado; contexto não vaza entre transações.
- Plataforma: cria e lista empresas; **recebe “permissão negada” ao ler responsáveis e auditoria**.
- Auditoria: numeração e horário definidos pelo banco; cadeia de hash; plataforma grava mas não lê; app não
  se passa por plataforma nem grava em outra empresa; UPDATE/DELETE bloqueados; segredos redigidos;
  20 inserções concorrentes sem buracos; adulteração (conteúdo alterado + último evento apagado por quem
  desligou as proteções) **detectada**; verificação sem empresa recusada.

**Problema encontrado e corrigido durante a fatia:** a função de verificação rodava como dona da tabela e,
com RLS forçado, não enxergava eventos (falso alarme de “ponta divergente”). Corrigido para rodar com as
permissões de quem chama + função mínima que só expõe a ponta da cadeia da empresa atual.

## 2026-10-23 · Fase A3a (login, MFA, perfis, convites) · mesmo ambiente

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | ✅ **62 testes**: banco 31 (+10 de identidade) · API 31 (+22 de login/perfis) |
| `pnpm lint` · `pnpm typecheck` · `pnpm format:check` · `pnpm build` | ✅ |
| `pnpm audit --audit-level low` | ✅ nenhuma vulnerabilidade (após forçar `esbuild` ≥ 0.25 no `drizzle-kit`) |
| API real + `curl` | ✅ `/health` ok; login sem origem → 403 `BAD_ORIGIN`; `/api/me` sem sessão → 401; CSP, HSTS, nosniff, X-Frame-Options presentes |
| `pnpm platform convidar-admin --slug comercial-exemplo …` | ✅ convite impresso uma única vez |

**Cobertura dos testes de login (`apps/api/test/auth.e2e.spec.ts`), contra PostgreSQL e Redis reais:**
cadastro aberto desativado; convite recusa senha fraca/token falso e vale uma vez; senha errada 401; admin sem
MFA vê só `/me` (403 `MFA_ENROLLMENT_REQUIRED` no resto); cadastro TOTP com código errado/certo (códigos gerados
por implementação RFC 6238 independente); novo login só libera após o 2º fator; código de recuperação de uso
único; sair invalida a sessão; perfil Leitura consulta mas não convida; isolamento entre empresas; desativar
usuário de outra empresa → 404; e-mail repetido com mensagem genérica; validação de entrada; não desativa a si
mesmo; desativação revoga a sessão na hora; auditoria com login aceito/negado, convite, desativação, sem senha
nos metadados e cadeia íntegra; CSRF (outra origem e sem origem) em rotas da API e de autenticação; limite de
5 logins/min por IP (429); bloqueio da conta após 10 falhas de IPs diferentes; limite de códigos de MFA;
erros sem detalhes internos.
**Banco (`packages/db/test/identity.spec.ts`):** `dw_auth` não cria usuário nem muda perfil/empresa/situação;
`dw_app` não altera flag de MFA nem lê sessões/senhas/segredos; plataforma cria só admin e não lê usuários;
e-mail único sem diferenciar maiúsculas; perfil inválido recusado.

**Problemas encontrados e corrigidos:**
1. `generateId: 'uuid'` esperava o banco gerar o ID → sessões falhavam (500). Corrigido com `randomUUID()`.
2. **Segurança:** o Better Auth **desliga a checagem de origem em ambiente de teste** e, mesmo em produção, não
   confere origem em login sem cookie. Forçamos `disableOriginCheck: false` e adicionamos checagem própria de
   origem em todo POST de `/api/auth/*`. Teste de CSRF agora prova o comportamento real.

**NÃO EXECUTADO:** cadastro/login por chave de acesso (passkey) — exige cerimônia WebAuthn no navegador; será
testado na A3b com o autenticador virtual do Chromium.

## 2026-10-23 · Fase A3b (telas de login) · mesmo ambiente + Chromium 141 (Playwright 1.64.1)

| Comando | Resultado |
|---------|-----------|
| `pnpm build` (db, api, web — Next.js 16.4.2) | ✅ 6 rotas estáticas: `/`, `/entrar`, `/verificacao`, `/convite`, `/configurar-seguranca` |
| `pnpm test` | ✅ 62 testes (banco 31 · API 31) |
| `pnpm e2e` | ✅ **9 testes de navegador** contra API + site reais e banco de teste recriado |
| `pnpm lint` · `pnpm typecheck` (3 pacotes) · `pnpm format:check` · `pnpm audit` | ✅ |

**Fluxos E2E (`apps/web/e2e`):** sem sessão → Entrar; convite (token some da barra de endereço; senha curta
recusada) → cadastro obrigatório de MFA (QR + chave manual; código errado recusado; código certo ativa) →
10 códigos de recuperação (botão só libera após confirmar que guardou) → **cadastro de chave de acesso com
autenticador virtual WebAuthn** → Visão geral com faixa “DADOS SIMULADOS”; convite reutilizado recusado;
senha errada com mensagem em português; login com senha + código do app (código errado recusado); login
com código de recuperação; **login só com chave de acesso**; cookie de sessão `HttpOnly`, `Secure`,
`SameSite=Lax` e invisível ao JavaScript; tema escuro aplica a paleta própria; “reduzir movimento” desliga
animações.

**Capturas para revisão:** `docs/design/telas-a3/` (geradas com `CAPTURAS=1 pnpm --filter @dw/web e2e`;
QR e códigos são de conta descartável do banco de teste).

**Problemas encontrados e corrigidos:** build do Next checava arquivos de teste; servidor herdava
`NODE_ENV=development`; o anunciador de rotas do Next também tem `role="alert"` (testes passaram a
procurar alertas só dentro do conteúdo principal).

**NÃO EXECUTADO:** E2E em Firefox/Safari; leitor de tela real; telas em celular (layout responsivo foi
escrito, mas não testado por captura); CI do GitHub com o job novo de E2E (roda após o push).

### CI no GitHub — falha da A3a (run 6) e correção
❌ [Run 6](https://github.com/DaviWillian03/DW-Solutions/actions/runs/39970061640) (commit `afe2f1f`): testes da API
falharam com `Failed to resolve entry for package "@dw/db"` — o `globalSetup` do Vitest não aplicava a condição
`source` e, na CI, não existe `dist` compilado (localmente havia `dist` antigo, por isso passava).
**Reproduzido localmente** apagando `dist`; **corrigido** com alias do Vitest para `packages/db/src/index.ts`.
Validação a partir do zero (sem `dist`/`.next`): lint, format, typecheck, 62 testes, build e 9 E2E ✅.
✅ A2 + ajuste do Dependabot: [run 5](https://github.com/DaviWillian03/DW-Solutions/actions/runs/39968189850) verde.
