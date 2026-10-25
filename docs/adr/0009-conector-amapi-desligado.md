# ADR-0009 — Conector da Android Management API pronto e desligado

- **Status:** Aceito · **Data:** 2026-10-25 · **Decisões:** CP6-1 a CP6-8

## Contexto
O MVP está completo no simulador. A AMAPI exige EMM comercial validado pelo Google; relatos recentes indicam cota
inicial de 0 aparelhos sem validação. O uso previsto (empresa, relação ainda indefinida — CP6-3/4) pode não se
enquadrar. Além disso, a AMAPI bloqueia e apaga por padrão aparelhos que descumprem senha/versão mínima.

## Decisão
1. Pacote `@dw/amapi` com mapeamento política → `Policy`, comando → `issueCommand`, token de cadastro, leitura do
   recurso `Device` e cliente REST com transporte e credencial **injetados**. Nenhuma dependência nova.
2. `AndroidManagementProvider` implementa o mesmo contrato do simulador, mas fica **desligado**
   (`enabled: false`): recusa toda operação antes de qualquer acesso à rede. Não está ligado na API.
3. **Trava de segurança:** a política nunca leva `passwordPolicies`, `passwordRequirements`, `minimumApiLevel`,
   `encryptionPolicy`, `keyguardDisabled`, `permittedInputMethods`, `permittedAccessibilityServices` nem
   `policyEnforcementRules`; se aparecerem, a conversão falha (`UnsafePolicyError`). Senha monitorada por
   `deviceSettings.isDeviceSecure`; versão/patch avaliados pelo DW Solutions.
4. Comandos usam a mesma validade do DW Solutions como `duration` (o padrão do Google é 10 min); apagar usa o
   comando `WIPE`. Aceite da operação ≠ aplicado (a confirmação vem do relatório do aparelho).
5. Cada empresa do DW Solutions corresponderá a uma `enterprise` no Google (cadastro de enterprise fica para quando
   houver cota).

## Para ligar (checklist, nada disso foi feito)
- Enquadramento comercial definido (CP6-4) e cota aprovada pelo Google.
- Conta de serviço como segredo do ambiente; Pub/Sub para notificações; região de hospedagem (CP8).
- Teste em aparelho de laboratório (CP6-6) com roteiro e confirmação de cada ação destrutiva.
- Conferir campos marcados “a confirmar” (ex.: `wipeParams`, tipos de evento de energia) na referência vigente.
