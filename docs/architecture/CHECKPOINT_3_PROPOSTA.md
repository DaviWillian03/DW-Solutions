# CHECKPOINT 3 — Proposta de arquitetura (2026-10-23)

Status: **proposta** — decisões marcadas ⏳ aguardam o usuário; o restante é recomendação técnica que vira
ADR após o checkpoint. Versões consultadas no npm em 2026-10-23; serão **fixadas (versão exata)** na Fase A.

## 1. Visão geral

```
Navegador ──HTTPS──▶ apps/web (Next.js) ──/api, mesma origem──▶ apps/api (NestJS)
                                                                 ├─▶ PostgreSQL  (isolamento por empresa ⏳)
                                                                 └─▶ Redis + BullMQ ──▶ apps/worker (NestJS)
                                                                                          └─▶ DeviceManagementProvider
                                                                                                ├─ SimulatorProvider (agora)
                                                                                                └─ AndroidManagementProvider (CP6, se elegível)
```

**Monólito modular + worker**: um backend dividido em módulos com fronteiras claras, e um processo
separado para filas. Sem microsserviços, Kubernetes, Kafka ou IA na v1 (prompt-mestre §3).

## 2. Stack recomendada

| Camada | Escolha | Versão (npm, 23/10/2026) | Motivo |
|--------|---------|--------------------------|--------|
| Runtime | Node.js | 22 LTS (container) · CI também em 24 LTS | já instalado; LTS |
| Linguagem | TypeScript | **6.0.x** | TS 7 (nativo) ainda não suportado por `@nestjs/swagger` (peer `^5.5 \|\| ^6`) |
| Monorepo | pnpm workspaces | pnpm 10.x (container) | Turborepo só se o build ficar lento |
| Frontend | Next.js (App Router) + React | 16.4 / 19.3 | prompt-mestre; SSR e rotas |
| UI | Tailwind CSS 4 + Radix (estilo shadcn/ui) + design system v1 | 4.3 | acessível, sem lock-in |
| Dados no front | TanStack Query 5 + TanStack Table 9 | — | cache e tabelas server-side |
| Formulários | React Hook Form + Zod 4 | zod 4.6 | mesmos esquemas do backend |
| Backend | NestJS + adaptador Express | 12.2 (ou 11.2 se algum pacote essencial não suportar 12) | módulos, injeção de dependência, guardas |
| Validação | Zod 4 com pipe próprio + `z.toJSONSchema()` para OpenAPI | — | `nestjs-zod` ainda não suporta Nest 12 |
| Documentação API | `@nestjs/swagger` (OpenAPI) | suporta Nest 12 | prompt-mestre |
| ORM | ⏳ Drizzle (recomendado) ou Prisma | drizzle-orm 0.45 · Prisma 7.10 (8.0 em RC) | ver §4 |
| Banco | PostgreSQL | 16 no container (produção ≥ 16) | RLS, JSONB, índices parciais |
| Filas | Redis 7 + BullMQ 6 | — | retries, backoff, deduplicação |
| Autenticação | ⏳ ver §3 | — | — |
| Logs | pino (JSON) + request/correlation ID | 10.4 | OpenTelemetry entra na Fase E |
| Testes | Vitest 5 · Supertest · Playwright 1.64 | — | unidade, integração (banco real), E2E |
| Qualidade | ESLint + Prettier, `tsc --noEmit` | — | padrão do ecossistema |

## 3. Autenticação ⏳ (CP3-1)

| Opção | Prós | Contras |
|-------|------|---------|
| **Better Auth embutido no backend** (recomendado) | TypeScript, roda sem Docker, sessões no nosso PostgreSQL, MFA TOTP + códigos de recuperação + “dispositivo confiável”, SSO/OIDC por plugin depois; R$ 0 | Biblioteca jovem com **vários alertas de segurança em 2026** (todos corrigidos: bypass de 2FA com `cookieCache` < 1.4.9; rate limit por IPv6 < 1.4.17; plugins OIDC/device < 1.6.11). Exige atualizar rápido e usar só plugins necessários |
| Keycloak (open source, Java) | Servidor OIDC maduro, MFA/WebAuthn prontos, console de administração, federação com Google/Microsoft | Pesado (Java 21, ~0,5–1 GB RAM), baixar ~200 MB a cada sessão do container, mais um serviço para operar e aprender |
| Serviço gerenciado (Auth0, Clerk, Entra External ID…) | Segurança operada por terceiros, MFA pronto | Conta externa, dados de login fora do nosso controle (LGPD), limites e preços do plano gratuito mudam, depende de internet nos testes |
| Fazer do zero | Aprendizado máximo | Maior risco de falha de segurança; não recomendado para produto |

Em qualquer opção: autenticação atrás de uma interface própria (`AuthPort`) para trocar depois; sessão em cookie
`HttpOnly; Secure; SameSite=Lax`; verificação de `Origin` + token anti-CSRF em requisições que alteram dados;
MFA **obrigatório** para administradores; rate limit nosso agrupando IPv6 por /64; senha inicial de
desenvolvimento **gerada aleatoriamente** e mostrada uma vez no terminal (nunca publicada).

## 4. Banco e isolamento entre empresas ⏳ (CP3-2, CP3-3)

**Isolamento recomendado: banco único + `tenant_id` em toda tabela empresarial + Row-Level Security (RLS).**
- O backend conecta com um usuário **sem** privilégio de ignorar RLS; cada requisição abre transação e faz
  `SET LOCAL app.tenant_id = '<uuid>'`; políticas `USING (tenant_id = current_setting('app.tenant_id')::uuid)`
  com `FORCE ROW LEVEL SECURITY`. Se o código esquecer o filtro, o banco bloqueia (defesa em profundidade).
- Operações de plataforma (criar empresa, suporte) usam papel separado e **sempre auditado**.
- Testes automáticos tentam ler/alterar dados de outra empresa e de filial não autorizada (IDOR).

**ORM recomendado: Drizzle.** Esquema em TypeScript próximo do SQL, transações explícitas (encaixa com
`SET LOCAL`), declara políticas RLS no próprio esquema, migrações em SQL legível. Contras: ainda versão 0.x.
**Prisma:** mais popular e com ótima documentação para iniciantes; RLS exige “extensão” que embrulha cada
consulta em transação; está migrando para a versão 8 (hoje em RC).

## 5. Módulos do backend (fronteiras)
`auth` · `tenancy` (empresas, filiais, departamentos) · `access` (usuários, papéis, permissões, escopo por filial) ·
`devices` (inventário, atribuições, snapshots, `desired_state`/`observed_state`) · `policies` (versões, diff,
atribuição) · `commands` (estados, aprovações, idempotência) · `providers` (contrato + simulador) ·
`audit` (append-only com hash encadeado) · `health`. Cada módulo expõe serviços; nenhum acessa tabelas de outro.

## 6. Estrutura do repositório (criada só quando houver uso)
```
apps/web   apps/api   apps/worker
packages/contracts   (Zod + tipos + DeviceManagementProvider)
packages/db          (esquema, migrações, políticas RLS, seeds sintéticos)
packages/config      (tsconfig/eslint compartilhados)
infrastructure/local (script de setup do container; docker-compose para quem rodar localmente)
docs/  tests/e2e
```

## 7. Ambiente e CI
- **Container (onde você desenvolve):** script `infrastructure/local/setup.sh` + gancho de início de sessão
  inicia PostgreSQL e Redis nativos, cria bancos de dev/teste, instala dependências. Sem Docker.
- **CI (GitHub Actions, plano gratuito):** lint, typecheck, testes com PostgreSQL/Redis como serviços,
  `pnpm audit`, varredura de segredos (gitleaks), SBOM CycloneDX, Dependabot. Varredura CodeQL apenas se
  disponível sem custo para o repositório.
- **Cadeia de suprimentos:** versões exatas + lockfile; pnpm `minimumReleaseAge` (não instalar versão
  publicada há menos de 7 dias); nenhum segredo no Git (`.env.example` só com nomes).

## 8. Hospedagem, região e custos
- **Agora:** R$ 0 — tudo roda no container (CP0-6). Nada é exposto à internet.
- **Futuro (CP8) ⏳ região:** recomendação Brasil (São Paulo) por LGPD e latência.
- **Estimativa grosseira, NÃO verificada** para um piloto pequeno (1 VM + PostgreSQL gerenciado + Redis):
  ordem de R$ 150–500/mês conforme provedor; será orçado com preços reais no CHECKPOINT 8.

## 9. Fica configurável depois (não precisa decidir agora)
Provedor de e-mail transacional · OpenTelemetry/Grafana · provedor de hospedagem · SSO corporativo (Google
Workspace/Microsoft Entra) · modo compacto de tabelas · i18n além de pt-BR.
