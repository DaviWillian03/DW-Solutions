# ADR-0007 — Políticas versionadas e conformidade

- **Status:** Aceito · **Data:** 2026-10-23 · **Decisões:** CP4-1 (Vendas e Merchandising), CP4-5 (política
  escolhida por aparelho), prompt-mestre §5.5 · **Tipo:** decisão técnica delegada (Fase C)

## Contexto
O MVP precisa aplicar uma política simples a smartphones de vendas e merchandising e mostrar se cada aparelho
está conforme, com motivo e horário. O prompt-mestre exige modelo declarativo independente do provedor, versões
com comparação, simulação antes de aplicar, nenhuma sobrescrita silenciosa e nenhum apagamento automático.

## Decisão
1. **Modelo declarativo em `@dw/contracts`** (`policySettingsSchema`, Zod estrito): senha e bloqueio de tela,
   apps obrigatórios, bloqueios (fontes desconhecidas, depuração USB, redefinição de fábrica), atualizações do
   sistema e regras de conformidade (Android mínimo e idade máxima do patch de segurança). Campos desconhecidos
   são recusados — não existe campo de “apagar se não conforme”.
2. **Versões imutáveis** (`policy_versions`, somente inserção por gatilho) e `policies.current_version` que só
   avança de 1 em 1. Restaurar = criar versão nova com a configuração antiga.
3. **Concorrência otimista:** publicar exige `baseVersion`; se outra pessoa publicou antes, a API devolve 409
   `VERSION_CONFLICT` em vez de sobrescrever. Versão sem mudanças → 422.
4. **Simular antes de publicar:** `POST /policies/:id/preview` devolve a comparação e o impacto estimado (aparelhos
   afetados, sem sinal, que passariam a falhar). O site só libera “Publicar” depois de uma simulação da
   configuração exata que será enviada. É estimativa sobre o último inventário — não prova o comportamento real.
5. **Desejado × aplicado:** o aparelho guarda `policy_version` (desejada) e `applied_policy_version` +
   `policy_reported_at` (relatados pelo aparelho). Ao trocar a política ou publicar versão nova, a conformidade
   vira **Desconhecido** (“aguardando o aparelho”) até o próximo relatório. Nada é dado como aplicado por
   suposição.
6. **Conformidade:** `evaluateCompliance` (função pura, usada pela API, simulador e testes) combina o relatório
   do aparelho (pendências como senha não criada ou app não instalado — como `nonComplianceDetails` da AMAPI) com
   regras avaliadas pelo DW Solutions no inventário (versão do Android e patch). Estados: Conforme, Não conforme,
   Desconhecido, Sem política; sempre com motivo, como resolver e horário.
7. **Atribuição em lote** de até 500 aparelhos; se qualquer ID não existir para a empresa (inclusive IDs de outra
   empresa, invisíveis pelo RLS), a operação inteira é recusada. Cada troca gera evento na linha do tempo e um
   registro de auditoria com motivo.
8. **Sem execução automática:** nenhuma regra de não conformidade bloqueia, restringe ou apaga aparelhos. No
   provedor real, `policyEnforcementRules` da AMAPI só serão configuradas com decisão explícita (CHECKPOINT 6).

## Consequências
- Mapeamento para a AMAPI (`passwordRequirements`, `maximumTimeToLock`, `applications`,
  `advancedSecurityOverrides`, `factoryResetDisabled`, `systemUpdate`) fica **a confirmar no CHECKPOINT 6** com
  a documentação oficial; a interface mostra isso em cada grupo de configurações.
- Rollout em etapas e catálogo de apps continuam fora do MVP (CP4).
- Os apps dos modelos prontos são fictícios (`exemplo.*`) e servem só para o simulador.
