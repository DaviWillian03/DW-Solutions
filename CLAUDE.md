# CLAUDE.md — DW Solutions

**DW Solutions** — MDM web para gestão de dispositivos **exclusivamente Android**, foco em empresas comerciais
(vendedores, lojas, estoque, PDV). Posicionamento: acessível. Idioma: tudo em português brasileiro
(exceto o nome “DW Solutions”).

## Antes de qualquer trabalho, leia
1. `docs/PROJECT_STATUS.md` — onde paramos e qual é o próximo passo.
2. `docs/PRODUCT_DECISIONS.md` — fonte da verdade das decisões (não contradizer sem nova decisão).
3. `docs/OPEN_QUESTIONS.md` — o que ainda depende do usuário.
4. `docs/ROADMAP.md` e `docs/adr/`.
5. `docs/PROMPT_MESTRE.md` — especificação completa e regras de colaboração.

## Regras inegociáveis (resumo)
- Seguir os CHECKPOINTS 0–8 do prompt-mestre; **parar e perguntar** quando a decisão é do usuário
  (negócio, marca, design, custos, provedores, privacidade, ações destrutivas, lançamento).
- Nunca confundir simulação, envio à API, ack do provedor e aplicação verificada no aparelho.
- Nunca afirmar elegibilidade/cota da Android Management API sem prova.
- Sem segredos no Git, sem senha padrão, sem backdoor, sem bypass de MFA.
- Nada de AccessibilityService/root/ADB/APIs privadas para obter privilégios. Sem vigilância oculta.
- Se um comando/teste não foi executado, escrever **NÃO EXECUTADO** — nunca inventar resultado.
- Atualizar `PROJECT_STATUS.md`, `PRODUCT_DECISIONS.md` e `OPEN_QUESTIONS.md` ao fim de cada etapa.
- **Decisões do usuário sempre em múltipla escolha** (ferramenta de perguntas, recomendação marcada).
- Usuário desenvolve só pelo Claude Code na nuvem: setup reproduzível por script, commit + push ao fim
  de cada etapa, mostrar telas por screenshot. Sem Docker daemon; usar PostgreSQL/Redis nativos.
- Orçamento R$ 0: não contratar serviço, domínio ou cloud sem aprovação.

## Design (CP2)
Seguir `docs/design/DESIGN_SYSTEM.md`: branco + azuis, Plus Jakarta Sans, menu no topo, tema do sistema,
monograma M2 (M1 no favicon), animações expressivas com `prefers-reduced-motion`, contraste AA verificado.

## Arquitetura (CP3)
Monólito modular TypeScript 6: `apps/web` (Next.js 16), `apps/api` (NestJS 12), `apps/worker` (BullMQ),
`packages/contracts|db|config`. PostgreSQL com **RLS por `tenant_id`** (toda consulta via `withTenant`),
Drizzle, Better Auth (TOTP + passkey, MFA obrigatório para admins), plataforma **sem acesso** a dados de
clientes. Ver `docs/adr/0002`–`0006`.

## Escopo (CP4)
MVP enxuto: colocar smartphones de **vendas e merchandising** sob gerenciamento. Perfis Admin e Leitura;
aparelho ligado a um responsável; políticas Vendas e Merchandising; comandos bloquear, reiniciar, modo
perdido, limpar dados de app e wipe (1 aparelho: nome + MFA; vários: 2º admin). Não expandir sem pedido.

## Comandos
- `pnpm setup` — prepara PostgreSQL/Redis/.env.local (o hook SessionStart já roda isso na nuvem)
- `pnpm test` · `pnpm lint` · `pnpm format` · `pnpm typecheck` · `pnpm build`
- `pnpm db:migrate` · `pnpm db:seed` (empresa fictícia + 250 aparelhos simulados) · `pnpm db:generate`
- `pnpm dev:worker` — worker do simulador (cadastro por QR e ciclo de check-ins a cada minuto)
- `pnpm platform criar-empresa|convidar-admin …` — ferramenta da plataforma (imprime o link de convite)
- `pnpm --filter @dw/api start` — API em http://127.0.0.1:3001 (`/health`, `/api/*`, `/api/auth/*`)
- `pnpm --filter @dw/web dev` — site em http://localhost:3000 (encaminha `/api` para a API)
- `pnpm e2e` — build + testes de navegador (usa dw_test e portas 3000/3001; `CAPTURAS=1` salva telas)
- Registrar resultados reais em `docs/TEST_REPORT.md`.

## Convenções de código
- API em **ESM** (NestJS 12): imports relativos com extensão `.js`; testes com Vitest + `unplugin-swc`.
- Dependências: versão exata; `minimumReleaseAge` de 7 dias bloqueia versões novas — escolha a anterior.
- Sem `console.log`: usar o logger pino; nunca logar segredos.
- Rotas da API negam por padrão: use `@Public()`, `@Roles('admin')`, `@AllowPendingMfa()` conscientemente.
- Operadores do Drizzle vêm de `@dw/db` (não importar `drizzle-orm` nos apps).
- Dados sincronizados sempre com origem e horário; “desconhecido” ≠ “sem sinal” ≠ perdido. Provedor
  real só via `DeviceManagementProvider` (`@dw/contracts`); hoje apenas `SimulatorProvider` (`@dw/simulator`).
- FKs entre tabelas de empresa são compostas `(tenant_id, id)` — a checagem de FK ignora o RLS.
- Site: textos em pt-BR, componentes de `apps/web/components/ui.tsx`, tokens do design system em
  `apps/web/app/globals.css`; nenhum botão finge funcionar (itens futuros ficam desabilitados com aviso).
- Dados de empresa **só** via `withTenant()` de `@dw/db`; RLS, permissões e gatilhos ficam em migrações SQL
  próprias (`packages/db/migrations/*_*.sql`), nunca editar migração já aplicada fora do ambiente local.

## Git
- Branch de desenvolvimento: `claude/mdm-android-corporate-bgfuws`.
- Commits pequenos e descritivos; não abrir PR sem pedido explícito.
