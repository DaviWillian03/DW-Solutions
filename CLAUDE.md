# CLAUDE.md — Projeto MDM (nome provisório)

MDM web para gestão de dispositivos **exclusivamente Android**, foco em empresas comerciais
(vendedores, lojas, estoque, PDV). Idioma de trabalho: português brasileiro.

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

## Comandos
Ainda não há código. Esta seção será preenchida na Fase A (após o CHECKPOINT 3).

## Git
- Branch de desenvolvimento: `claude/mdm-android-corporate-bgfuws`.
- Commits pequenos e descritivos; não abrir PR sem pedido explícito.
