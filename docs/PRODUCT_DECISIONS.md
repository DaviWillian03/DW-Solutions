# Decisões de Produto — Fonte da Verdade

Formato: ID · pergunta · opções · decisão · motivo · data · consequências · reversível?
Status possíveis: `ABERTA`, `DECIDIDA`, `SUBSTITUÍDA`.

## Decisões tomadas

| ID | Assunto | Decisão | Data | Reversível? |
|----|---------|---------|------|-------------|
| D-000 | Nome de trabalho | “Projeto MDM” até o CHECKPOINT 1 (definido pelo prompt-mestre) | 2026-10-23 | Sim |
| D-001 | Plataforma-alvo | Somente Android; sem módulo iOS (definido pelo prompt-mestre) | 2026-10-23 | Não previsto |
| D-002 | Documento de referência | `docs/PROMPT_MESTRE.md` é a especificação base | 2026-10-23 | Sim, por nova decisão |

## Decisões abertas — CHECKPOINT 0 (Viabilidade, intenção e ambiente)

Aguardando resposta do usuário. Ver detalhes e opções em `docs/OPEN_QUESTIONS.md`.

| ID | Pergunta | Recomendação inicial | Status |
|----|----------|----------------------|--------|
| CP0-1 | Uso interno de uma empresa ou MDM comercial/SaaS? | C (projeto com visão comercial, começando em modo simulador) | ABERTA |
| CP0-2 | Propriedade dos aparelhos: corporativos, mistos ou BYOD? | A (100% corporativos: Fully Managed + Dedicated) | ABERTA |
| CP0-3 | Fabricantes e versões Android prioritários | Samsung + Motorola, Android 12+ com GMS | ABERTA |
| CP0-4 | Tamanho da frota inicial e futura | Projetar para até ~5.000 sem reescrita; MVP testado com 500 simulados | ABERTA |
| CP0-5 | Ferramentas e ambiente disponíveis | Claude Code + Docker + Git; Android Studio e aparelho de teste opcionais | ABERTA |
| CP0-6 | Orçamento e cloud vs. on-premise | Custo zero na fase de simulador (tudo local) | ABERTA |
| CP0-7 | Já existe MDM/acesso autorizado a APIs? | Nenhum por enquanto → modo simulador | ABERTA |
