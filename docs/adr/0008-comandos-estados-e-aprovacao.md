# ADR-0008 — Comandos remotos: estados verificáveis, aprovação dupla e refazer MFA

- **Status:** Aceito · **Data:** 2026-10-23 · **Decisões:** CP4-2 (5 comandos), CP4-6 (regra do wipe),
  prompt-mestre §5.7 e §8 · **Tipo:** decisão técnica delegada (Fase D)

## Contexto
O MVP precisa bloquear, reiniciar, ativar/desativar modo perdido, limpar dados de app e apagar aparelhos — tudo
no simulador — sem nunca confundir “a API aceitou” com “o aparelho aplicou”, com regras fortes para ações
irreversíveis e com o cenário de aparelho desconectado que volta dias depois.

## Decisão
1. **Estados** (`@dw/contracts`): solicitado → validado → [aguardando aprovação] → na fila → enviado ao provedor →
   confirmado pelo provedor → recebido pelo aparelho → **aplicação verificada**; finais: falhou, expirou,
   cancelado. Cada transição fica em `command_events` (somente inserção) com o ator (usuário, sistema, provedor ou
   aparelho). Estado final não muda (gatilho no banco).
2. **Fila e worker:** a API só grava e enfileira (`command`); o worker envia ao provedor com **3 tentativas** para
   erro temporário e, esgotadas, marca “falhou” com motivo. O aceite do provedor nunca é tratado como aplicação.
   No simulador, aparelho alcançável é “acordado” logo após o aceite (papel da notificação do provedor).
3. **Validade:** bloquear/reiniciar 24 h, modo perdido 7 dias, limpar dados 72 h, apagar 30 dias, aprovação 24 h.
   Vencido sem o aparelho receber → **expirou** e nunca é executado atrasado.
4. **Cancelamento** só enquanto o aparelho não recebeu (até “confirmado pelo provedor”).
5. **Sem duplicar:** um comando do mesmo tipo pendente bloqueia outro igual; chave de idempotência por pedido.
6. **Apagar aparelho:** desligado por padrão (`tenant_settings`); ligar exige refazer MFA. **1 aparelho:** motivo,
   nome do aparelho digitado e código do app. **Vários:** motivo, “APAGAR N”, código do app de quem pede e
   **aprovação de outro administrador** (com código do app) em até 24 h; quem pede não aprova (regra também no
   banco). Ao apagar, o aparelho sai do gerenciamento e o que estava pendente para ele é cancelado.
7. **Refazer MFA:** verificação TOTP do Better Auth com a sessão atual, acrescida de limite próprio (5 erros em
   15 min por usuário) e **código de uso único** (o Better Auth não limita nem impede reuso com sessão ativa).
8. **Auditoria:** todo pedido, aprovação, recusa, cancelamento e mudança de configuração; **tentativas negadas
   também** (wipe desligado, quem pediu tentando aprovar, código errado/reutilizado).
9. **Modo perdido:** mensagem e telefone na tela; **localização não é coletada** nesta versão.

## Consequências
- Mapeamento para a AMAPI (`issueCommand` LOCK/REBOOT/START_LOST_MODE/STOP_LOST_MODE/CLEAR_APP_DATA e remoção do
  aparelho com apagamento) e o significado real de cada etapa ficam **a confirmar no CHECKPOINT 6**.
- “Simular comunicação do aparelho agora” existe só no simulador, para demonstrar a entrega e o retorno de
  aparelho sem sinal.
- Lotes de bloquear/reiniciar não exigem aprovação (CP4: “um clique + confirmação”).
