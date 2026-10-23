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

## 2026-10-23 · Fase B (simulador e aparelhos) · mesmo ambiente

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | ✅ **100 testes**: banco 38 · simulador 10 · API 48 · worker 4 |
| `pnpm e2e` (API + site + **worker** reais, banco de teste, 120 aparelhos simulados) | ✅ **17 testes de navegador** |
| `pnpm lint` · `pnpm typecheck` (7 pacotes) · `pnpm format:check` · `pnpm audit` | ✅ |
| `pnpm db:seed` (dev) | ✅ 220 responsáveis e 250 aparelhos: 226 com sinal · 17 sem sinal +24 h · 7 desconhecidos |
| Worker real por 14 s (`SIM_TICK_SECONDS=5`) | ✅ 59 check-ins no 1º ciclo; encerramento limpo ao receber SIGTERM |

**Cobertura nova:**
- Banco: FK composta impede ligar aparelho a responsável/evento de outra empresa mesmo com ID conhecido;
  aparelhos sem DELETE; linha do tempo somente inserção; plataforma não lê aparelhos.
- Simulador: frota reproduzível, distribuição realista, nunca observado sem telemetria inventada, toda leitura
  com horário, só Samsung/Motorola Android 12–15, QR de demonstração fora do formato Android, check-ins
  respeitam silenciosos, cadastro simulado usa o token uma vez.
- API: paginação no servidor, isolamento e IDOR (404), filtros validados, busca sem curingas do usuário,
  resumo consistente, capacidades com classificação honesta, troca de responsável com motivo/linha do tempo,
  perfil Leitura bloqueado, QR com token só na resposta (hash no banco, nunca em listagens), leitura simulada
  vira tarefa na fila, token de outra empresa recusado.
- Worker: cadastro idempotente (mensagem repetida não duplica), ignora token expirado/sem leitura/de outra
  empresa, “sem sinal” registrado uma única vez, silenciosos nunca inventam comunicação.
- E2E: visão geral com números reais e origem; filtro e busca; página do aparelho; capacidades; troca de
  responsável auditada; **cadastro por QR de DEMONSTRAÇÃO concluído de forma assíncrona pelo worker**;
  cadastro de responsável; convite de Leitura; perfil Leitura sem ações de admin; tema escuro.

**Capturas para o CHECKPOINT 5:** `docs/design/telas-b/` (`CAPTURAS=1 pnpm e2e`).

**Problemas encontrados e corrigidos:** FKs compostas geradas antes dos índices únicos (migração reordenada);
página de 1 item no teste abaixo do mínimo validado (teste corrigido); erro de lint chegou a um commit e foi
corrigido no seguinte (sequência de comandos passou a parar no lint); worker em `warn` não anunciava o início
esperado pelo Playwright.

**NÃO EXECUTADO:** responsividade em celular por captura; leitor de tela real; carga com 500 aparelhos no
navegador (a API foi testada com até 120 por empresa nos E2E e 400 na geração de frota).

**CI da Fase B4 (commit 63e726d):** ✅ todos os jobs passaram — lint/tipos/testes em Node 22 e 24,
segurança da cadeia de suprimentos e testes de navegador (17 E2E com worker real):
https://github.com/DaviWillian03/DW-Solutions/actions/runs/39975906990

## 2026-10-23 · Fase C (políticas e conformidade) · mesmo ambiente

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | ✅ **141 testes**: contratos 10 · banco 45 · simulador 17 · API 65 · worker 4 |
| `pnpm e2e` (API + site + worker reais, banco de teste) | ✅ **23 testes de navegador** (5 execuções; 1 falhou por corrida no próprio teste — corrigida) |
| `pnpm lint` · `pnpm typecheck` (8 pacotes) · `pnpm format:check` · `pnpm build` | ✅ |
| `pnpm audit --audit-level high` | ✅ nenhuma vulnerabilidade conhecida |
| `pnpm db:migrate` + `pnpm db:seed` (dev recriado) | ✅ 250 aparelhos: 178 conformes · 69 não conformes (50 patch de segurança com mais de 180 dias, 15 senha não criada, 8 app obrigatório não instalado) · 3 desconhecidos |

**Cobertura nova:**
- Contratos: esquema estrito (campo desconhecido, pacote inválido, app repetido, janela vazia, limites de senha),
  comparação legível entre versões, conformidade nunca “conforme” por suposição, motivo + correção em cada regra.
- Banco: políticas e versões isoladas por empresa (RLS), FK composta impede política de outra empresa, versões
  imutáveis, política sem DELETE, nome/modelo imutáveis, versão só avança de 1 em 1, número de versão único.
- Simulador: frota ligada às políticas (promotores → Merchandising), nunca vistos ficam “Desconhecido”, check-in
  aplica a versão nova e registra linha do tempo, cadastro com política já sai com a versão aplicada.
- API: perfis (Leitura só consulta), isolamento 404 em política/versão/comparação, simulação sem efeito colateral,
  400 para configuração inválida, 422 sem mudanças, **409 em edição sobre versão antiga**, aparelhos passam a
  “aguardando” ao publicar, lote idempotente, lote recusado inteiro com aparelho de outra empresa, limite de 500,
  filtros e resumo de conformidade consistentes, cadastro por QR com política.
- E2E: aparelho não conforme mostra motivo e “como resolver” (fluxo 3 do CP4); publicar só depois de simular (e
  simular de novo se algo mudou); histórico e comparação; **conflito entre duas abas**; troca em lote; as duas
  ilustrações (claro e escuro); perfil Leitura sem edição.

**Capturas:** `docs/design/telas-c/` (`CAPTURAS=1 pnpm e2e`); `docs/design/telas-b/` atualizadas.

**Problemas encontrados e corrigidos:**
- Um commit (C1) foi enviado com 1 teste do simulador falhando: o comando de verificação usava `| grep &&`, que
  não para em falha. Causa do teste: escolha não determinística de aparelho. Corrigido no commit seguinte; a
  verificação passou a usar um script que para no primeiro erro.
- Seletores “Trocar política” e “Novo responsável” mostravam a 1ª opção em vez do valor atual (opções chegam
  depois do valor inicial) — risco de remover a política sem querer. Corrigido e coberto por teste E2E.
- Visão geral com 6 indicadores numa linha ficou espremida em 1280 px — reorganizada em grade 3×2.
- Capturas de página inteira mostravam o cabeçalho fixo no meio (efeito da captura) — rolagem ao topo antes.

**NÃO EXECUTADO:** leitor de tela real; responsividade em celular por captura; carga de políticas com 500
aparelhos no navegador (API testada com lote de até 500 IDs na validação, 50–120 aparelhos reais por empresa).

**CI da Fase C (commit 23d6854):** ✅ todos os jobs, incluindo os 23 testes de navegador:
https://github.com/DaviWillian03/DW-Solutions/actions/runs/39994031473 (runs de C1 e da correção foram
canceladas pela run seguinte; C2 verde: https://github.com/DaviWillian03/DW-Solutions/actions/runs/39991728606)

## 2026-10-23 · Fase D (comandos) · mesmo ambiente

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | ✅ **175 testes**: contratos 10 · banco 51 · simulador 17 · API 82 · worker 15 |
| `pnpm e2e` (API + site + worker reais, banco de teste) | ✅ **27 testes de navegador** (4 execuções; 1 falhou por verificação fraca no próprio teste — corrigida) |
| `pnpm lint` · `pnpm typecheck` (8 pacotes) · `pnpm format:check` · `pnpm build` | ✅ |
| `pnpm audit --audit-level high` | ✅ nenhuma vulnerabilidade conhecida |
| `pnpm db:migrate` (dev) | ✅ migrações 0009–0010 aplicadas |

**Cobertura nova:**
- Banco: comandos isolados por empresa; FK composta impede comando para aparelho de outra empresa; tipo, alvo e
  solicitante imutáveis; sem DELETE; histórico somente inserção; estado final não volta; quem pede não aprova;
  decisão do lote é única; apagamento desligado por padrão.
- Worker: aceite do provedor ≠ aplicação; idempotência; 3 tentativas com falha explicada; vencido e cancelado não
  são enviados; bloquear com todas as etapas; modo perdido liga/desliga (e falha se não estava ativo); limpar dados
  falha se o app não existe; apagar tira o aparelho do gerenciamento e cancela pendentes; **aparelho sem sinal:
  comando expira e não executa quando ele volta 3 dias depois**; com prazo válido, executa ao voltar.
- API: fila + tarefa para o worker; idempotência; sem duplicar pendente; modo perdido exige mensagem, motivo e
  nome; cancelamento auditado; perfil Leitura só acompanha; wipe desligado recusado e auditado; ligar exige MFA;
  código reutilizado recusado; código errado recusado e auditado; wipe de 1 aparelho; lote de wipe com 2º admin
  (quem pede não aprova, aprovar exige MFA, decisão única); recusa cancela com motivo; lote de bloqueio informa
  ignorados; isolamento entre empresas; **5 códigos errados bloqueiam por 15 min**; validação de tipo/parâmetros.
- E2E (fluxo 4 do CP4): modo perdido até “aplicação verificada”; apagar 1 aparelho com wipe desligado → ligar em
  Configurações (código errado e certo) → nome errado recusado → apagado e fora do gerenciamento; lote de bloqueio;
  lote de apagamento aguardando outro admin (quem pediu não vê “Aprovar”) e retirado; visão geral com comandos e
  modo perdido; perfil Leitura sem ações.

**Capturas:** `docs/design/telas-d/` (`CAPTURAS=1 pnpm e2e`); telas B e C recapturadas.

**Problemas encontrados e corrigidos:** aparelho apagado continuava em “fora da política” (agora sai do
gerenciamento sem política); menu do topo com 7 itens quebrava texto em 1280 px (subtítulo da marca só em telas
largas, itens sem quebra); geração de migração dependia do build de `@dw/contracts` (script `db:generate` agora
compila antes); teste E2E aceitava o rótulo de etapa ainda não concluída (passou a exigir a marca ✓).

**NÃO EXECUTADO:** aprovação de lote pelo 2º admin no navegador (coberta nos testes da API); leitor de tela real;
celular por captura; carga de 500 comandos em lote no worker.
