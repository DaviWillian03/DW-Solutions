# ADR-0001 — Rota Android: simulador primeiro, AMAPI como destino comercial

- **Status:** Aceito
- **Data:** 2026-10-23
- **Decisões relacionadas:** CP0-1, CP0-2, CP0-7

## Contexto
O projeto é de estudo/portfólio com visão comercial futura. A Android Management API (AMAPI) é
restrita a desenvolvedores comerciais de EMM que vendem e dão suporte a clientes externos; soluções de
uso exclusivamente interno não se enquadram. A antiga Play EMM API não aceita novos DPCs
personalizados. Não há MDM existente, credenciais Google, orçamento ou aparelho de teste resetável.

## Decisão
1. Todo o desenvolvimento ocorre contra uma abstração `DeviceManagementProvider`, com o
   `SimulatorProvider` como único provedor ativo.
2. O destino real previsto é a **AMAPI (rota A)**, ativada somente quando houver enquadramento
   comercial, quota aprovada e aparelho de laboratório (CHECKPOINT 6).
3. Rota C (DPC de laboratório) fica opcional, apenas para aprendizado, nunca como produto.
4. Rota B (MDM de terceiros) fica possível via futuro `ExternalMdmProvider`.

## Consequências
- O simulador precisa ser realista: estados assíncronos, atrasos, falhas, aparelhos offline, acks
  separados de “aplicação verificada”.
- Todo dado exibe `source = simulator` e banner “DADOS SIMULADOS”.
- O modelo de políticas é agnóstico, mas inspirado nos campos da AMAPI para facilitar o mapeamento.
- Nenhuma tela pode sugerir que aparelhos reais estão sendo gerenciados.
