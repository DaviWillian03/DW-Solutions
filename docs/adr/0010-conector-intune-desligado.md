# ADR-0010 — Conector Microsoft Intune (Microsoft Graph) pronto e desligado

- **Status:** Aceito · **Data:** 2026-10-25 · **Decisões:** B-4, I-1 a I-9 · Substitui a rota do ADR-0009 para uso
  interno (o `@dw/amapi` fica como referência)

## Contexto
A empresa vai usar o DW Solutions internamente (CP6-3) e já tem Microsoft 365. A AMAPI não permite uso
exclusivamente interno, então o provedor real passa a ser o **Microsoft Intune**, via Microsoft Graph. A pesquisa
está em `docs/android/INTUNE.md`. Pontos que pesam:
- **No Android, o Intune tem:** bloquear, reiniciar (COBO/COSU), apagar, localizar e tocar som.
- **No Android, o Intune não tem:** modo perdido e limpar dados de app.
- **Partes do Graph só no `/beta`:** o perfil de configuração do Android totalmente gerenciado e o perfil de cadastro
  por QR.
- **Como a ação responde:** com `204` sem número de operação. O estado aparece depois, em
  `managedDevice.deviceActionResults`.
- **Um alerta de wipe:** bloquear a redefinição de fábrica faz o wipe não terminar em Samsung.
- **Conformidade do Intune:** a enumeração de ações aceita `block`, `retire` e `wipe` automáticos.

## Decisão
1. Pacote `@dw/intune` no mesmo padrão do `@dw/amapi`:
   - cliente Graph com transporte e token **injetados**, sem dependência nova;
   - só IDs no formato GUID e só ações de uma lista fechada;
   - `nextLink` só é aceito se apontar para `graph.microsoft.com`;
   - 429/5xx viram `TransientProviderError`.
2. **Comandos:**
   - `lock` → `remoteLock`, `reboot` → `rebootNow`, `wipe` → `wipe` com `persistEsimDataPlan: true`;
   - `start/stop_lost_mode` e `clear_app_data` → `UnsupportedCapabilityError` (I-1);
   - Localizar e Tocar som entram como comandos novos na fatia I2.
3. **Estado do comando:**
   - o `204` vira `provider_accepted`;
   - o `deviceActionResults` mais recente da mesma ação, iniciado depois do envio, define o resto: `done` → recebido
     pelo aparelho, `failed`/`notSupported`/`canceled` → falhou;
   - “aplicação verificada” só com sinal do aparelho: reinício ⇒ `lastSyncDateTime` posterior; bloquear ⇒ `done`
     relatado pelo próprio aparelho; apagar ⇒ o aparelho sai do Intune.
4. **Inventário** (`managedDevice` v1.0):
   - vem com origem `intune` e o horário `lastSyncDateTime`;
   - bateria, rede e “tem senha” **não vêm** e ficam “desconhecido”;
   - o `complianceState` do Intune é mostrado à parte e **não substitui** a avaliação do DW (ADR-0007).
5. **Políticas** (I-2):
   - cada versão publicada vira um `androidDeviceOwnerGeneralDeviceConfiguration` (/beta), atribuído ao grupo da
     política;
   - os apps obrigatórios viram `mobileAppAssignment` `required` para o mesmo grupo (só apps já aprovados no Google
     Play gerenciado);
   - a trava `assertSafeConfiguration` recusa qualquer campo `password*` além do tempo de tela,
     `*SignInFailureCountBeforeFactoryReset` e `factoryResetBlocked` (I-8, I-9);
   - o Localizar dos dedicados fica desligado (I-6).
6. **Conformidade do Intune:** o DW **não cria** políticas de conformidade. `findAutomaticActions` lê as do tenant e
   denuncia ações automáticas (`block`, `retire`, `wipe`, `remoteLock`) para o admin ver.
7. **Grupos** (I-7): a TI cria os grupos; o DW só adiciona e remove membros, usando o objeto de aparelho do Entra
   achado pelo `azureADDeviceId`.
8. **Cadastro:** um perfil de cadastro por modo (COBO/COSU) criado pela TI. O DW chama `createToken` com a validade
   pedida e lê `qrCodeContent`. Os campos de Wi-Fi nunca são usados.
9. `IntuneProvider` implementa o contrato do simulador e fica **desligado** (`enabled: false`): recusa toda operação
   antes de qualquer acesso à rede. Não está ligado na API.

## Permissões mínimas do aplicativo no Entra (para o passo a passo da TI)
| Para quê | Permissão (aplicativo) |
|----------|------------------------|
| Ler aparelhos | `DeviceManagementManagedDevices.Read.All` |
| Bloquear, reiniciar, apagar, localizar | `DeviceManagementManagedDevices.PrivilegedOperations.All` |
| Perfis de configuração, cadastro e atribuição de apps | `DeviceManagementConfiguration.ReadWrite.All`, `DeviceManagementApps.ReadWrite.All` |
| Achar o aparelho no Entra e mexer nos membros dos 2 grupos | `Device.Read.All`, `GroupMember.ReadWrite.All` (**a confirmar**) |

## Para ligar (checklist, nada disso foi feito)
- Licença confirmada (I-3): Business Premium, E3/E5 ou Intune avulso, mais licença de aparelho para os dedicados.
- Aplicativo no Entra criado pela TI (I-4), com o segredo/certificado como segredo do ambiente (CP8).
- Aparelho Samsung/Motorola de laboratório (CP6-6) com roteiro, e confirmação de cada ação destrutiva.
- Conferir no laboratório:
  - os nomes reais de `actionName`;
  - se o `remoteLock` relata `done`;
  - se o perfil /beta aceita os campos;
  - o bloqueio automático da senha (I-9).
