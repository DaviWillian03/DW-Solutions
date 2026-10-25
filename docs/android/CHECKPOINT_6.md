# CHECKPOINT 6 — Inscrição/integração com Android real (decidido em 2026-10-25 — ver CP6-0…8)

## O que foi verificado agora
| Fato | Fonte | Grau de certeza |
|------|-------|-----------------|
| AMAPI é restrita a EMMs **comerciais** (vendem a entidades externas, com acordo direto com cada cliente), provedores de Device Trust e OEMs; uso exclusivamente interno (first party) **não** se enquadra | [Permissible usage (oficial)](https://developers.google.com/android/management/permissible-usage), lida em 2026-10-25 | Oficial |
| Cota inicial de até 500 aparelhos exige justificativa de negócio completa; pedido pelo formulário goo.gle/android-enterprise-response; no máximo 2 projetos com cota por desenvolvedor | Mesma página | Oficial |
| A página oficial **não** fala de cota de desenvolvimento/teste antes da aprovação | Mesma página | Oficial (ausência) |
| Projetos novos começam com **0 aparelhos**: sem aprovação, nem um aparelho de teste consegue ser cadastrado | [FAQ bayton.org (mar–abr/2026)](https://bayton.org/android/android-enterprise-faq/amapi-device-quota-limits/); [comunidade Android Enterprise (dez/2025)](https://www.androidenterprise.community/android-enterprise-general-discussions-3/initial-android-management-api-device-limit-is-0-after-enterprise-creation-how-can-we-test-during-quota-review-period-1580) | **Não oficial** — relatos consistentes, sem resposta do Google |
| Pedidos de cota levam de 7 dias úteis a semanas | FAQ bayton.org | Não oficial |

**Conclusão honesta:** hoje o DW Solutions **não tem elegibilidade comprovada** para a AMAPI (projeto de estudo,
sem CNPJ, sem cliente externo, orçamento R$ 0). Não é possível cadastrar nem um aparelho real pela AMAPI sem
passar pela validação do Google. Nada no sistema deve sugerir o contrário.

## Rotas possíveis agora
| Rota | O que entrega | Custo | Depende de |
|------|---------------|-------|------------|
| **1. Conector AMAPI “pronto para ligar”** | `AndroidManagementProvider` implementado contra a documentação oficial, testado com respostas de exemplo (sem rede); mapeamento política → JSON da AMAPI; nada é enviado ao Google | R$ 0 | Nada externo |
| 2. Laboratório com Test DPC | Aprender o comportamento real (QR de provisionamento, modo totalmente gerenciado, bloqueio) em um aparelho próprio que pode ser apagado | R$ 0 se já houver aparelho | Aparelho resetável; não vira produto |
| 3. Pedir cota da AMAPI | Caminho comercial real | Tempo; pode exigir Google Cloud com faturamento | Empresa/CNPJ, cliente externo, justificativa de negócio |
| 4. Só simulador | Nada novo de Android real | R$ 0 | — |

## Regras que continuam valendo
- Nunca apagar, redefinir, bloquear ou trocar a propriedade de um aparelho real sem confirmação específica do
  operador autorizado e sem ser aparelho de laboratório.
- Credenciais (conta de serviço do Google) nunca no Git; só por segredo do ambiente.
- Primeiro cadastro e leitura; depois políticas seguras; só depois comandos sensíveis (prompt-mestre, Fase F).

## Achado crítico: bloqueio e apagamento automáticos por padrão
[Set up policy compliance rules (oficial)](https://developers.google.com/android/management/compliance): se o aparelho
descumpre `passwordPolicies`, `encryptionPolicy`, `keyguardDisabled`, `permittedInputMethods`,
`permittedAccessibilityServices` ou a versão mínima, o Android Device Policy **bloqueia na hora e redefine o aparelho
após 10 dias** (sem preservar a proteção contra roubo). `policyEnforcementRules` ajusta os prazos (até 30 dias;
apagamento sempre depois do bloqueio); a página não diz se o apagamento pode ser desligado.
**Decisão (CP6-7/8): senha e versão mínima só monitoradas — essas chaves nunca são enviadas.**
