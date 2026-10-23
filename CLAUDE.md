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

## Comandos
Ainda não há código. Esta seção será preenchida na Fase A (após o CHECKPOINT 3).

## Git
- Branch de desenvolvimento: `claude/mdm-android-corporate-bgfuws`.
- Commits pequenos e descritivos; não abrir PR sem pedido explícito.
