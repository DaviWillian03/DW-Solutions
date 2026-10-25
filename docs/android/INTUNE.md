# Rota real: Microsoft Intune via Microsoft Graph (pesquisa 2026-10-25)

**Decisão B-4:** a empresa vai usar o **Microsoft Intune**, ou seja, uso interno. O DW Solutions fica como um painel em
cima do Intune e fala com ele pelo Microsoft Graph. Nada foi contratado nem ligado, e nenhuma chamada real foi feita.
Tudo abaixo vem da documentação oficial da Microsoft (Microsoft Learn), conferida na data acima; o comportamento em
aparelho real **não foi testado**.

Modos de cadastro que interessam (Android Enterprise, aparelho da empresa):
- **Totalmente gerenciado (COBO):** celular de vendedor com usuário.
- **Dedicado (COSU):** aparelho sem usuário, como quiosque ou PDV.

## 1. Comandos do DW Solutions × ações do Intune no Android
| DW Solutions | Intune (Graph v1.0) | Android da empresa | Observação oficial |
|--------------|---------------------|--------------------|--------------------|
| Bloquear | `POST /deviceManagement/managedDevices/{id}/remoteLock` | COBO, COSU, COPE ✅ | Só adianta se o aparelho **já tiver senha**: sem senha, a tela apenas apaga |
| Reiniciar | `.../rebootNow` | COBO e COSU ✅ (COPE ❌) | Começa em até ~5 min e depende de notificação push: com o aparelho desligado da internet, fica para depois |
| Apagar (redefinição de fábrica) | `.../wipe` (`persistEsimDataPlan`) | COBO, COSU, COPE ✅ | Limite de **500 por dia por tenant**. Em Samsung, se “Redefinição de fábrica” estiver **bloqueada** no perfil, o wipe **não termina** e o aparelho perde contato |
| Modo perdido | — | **Não existe no Android** | O modo perdido do Intune é só para iPhone/iPad e ChromeOS. No Android há “Localizar aparelho” e “Tocar som de aparelho perdido” |
| Limpar dados de app | — | **Não existe no Intune** | Não aparece na lista de ações do Android |

Outras ações que o Intune oferece no Android e que hoje **ficam fora do escopo** (CP4): aposentar (`retire`), excluir,
sincronizar (`syncDevice`), redefinir senha, localizar, tocar som, notificação personalizada, assistência remota.

**Como saber o estado de uma ação:** `managedDevice.deviceActionResults[]` traz `actionName`, `actionState`
(`pending`, `canceled`, `active`, `done`, `failed`, `notSupported`), `startDateTime` e `lastUpdatedDateTime`. A resposta
do comando é `204 No Content`, sem número de operação. Por isso:
- `204` vira **aceito pelo provedor**;
- `done` vira **confirmado pelo aparelho**, mas só **depois que o DW Solutions ler o estado de novo**;
- `failed` e `notSupported` viram **falhou**;
- “aplicação verificada” continua exigindo um sinal do próprio aparelho: o reinício confirma pelo novo `lastSyncDateTime`; o
  apagamento confirma quando o aparelho some ou volta não cadastrado.

## 2. Inventário (`managedDevice`, Graph v1.0)
O Intune entrega estes campos: `id`, `deviceName`, `managedDeviceOwnerType` (company/personal), `enrolledDateTime`,
`lastSyncDateTime`, `operatingSystem`, `osVersion`, `androidSecurityPatchLevel`, `manufacturer`, `model`,
`serialNumber`, `imei`, `complianceState` (`unknown`, `compliant`, `noncompliant`, `conflict`, `error`, `inGracePeriod`,
`configManager`), `isEncrypted`, `userPrincipalName`, `userDisplayName`, `totalStorageSpaceInBytes`,
`freeStorageSpaceInBytes`, `phoneNumber`, `subscriberCarrier`, `wiFiMacAddress`, `enrollmentProfileName` e
`deviceActionResults`.

O que **não** vem:
- **bateria**;
- **tipo de rede** em uso;
- **se a tela tem senha**.

Esses dados ficam como “desconhecido”, com o provedor como origem, e **nunca** viram “sem sinal”. A senha só pode ser
monitorada por uma **política de conformidade** do Intune (ver §4).

## 3. Cadastro por QR
O recurso `androidDeviceOwnerEnrollmentProfile` só existe no Graph **/beta**. A Microsoft avisa que o /beta “muda com
mais frequência” e recomenda o v1.0 quando houver. Pontos principais:
- `enrollmentMode` aceita `corporateOwnedFullyManaged` ou `corporateOwnedDedicatedDevice`.
- `createToken` e `revokeToken` criam e revogam o token.
- `qrCodeContent` e `tokenExpirationDateTime` trazem o QR e a validade.
- `deviceNameTemplate` aceita `{{SERIAL}}` e outros.
- Os campos `wifiPassword` **não serão usados**, para não guardar senha de Wi-Fi.

## 4. Políticas e o risco de bloqueio automático
- Toda política de conformidade do Intune vem com a ação **“Marcar como não conforme”** em 0 dias, e ela não pode ser
  removida. Isso é só um rótulo. Quem bloqueia acesso a e-mail e SharePoint é o **Acesso Condicional do Entra**, e só
  se a empresa o configurar.
- Ações opcionais por agenda:
  - e-mail e notificação push (não bloqueiam);
  - **“Bloquear remotamente o aparelho não conforme”**: bloqueio **automático**, que **conflita com CP6-7/8 e ADR-0007**;
  - **“Adicionar à lista de aposentadoria”**: o aparelho só é aposentado quando um admin confirma.
  - **Nenhuma ação de conformidade apaga o aparelho automaticamente.**
- A regra que vem para o DW Solutions é **nunca criar ou aceitar uma política de conformidade com bloqueio remoto
  automático**. O conector deve recusar essa configuração, como a trava do `@dw/amapi`.
- Configuração do aparelho (apps obrigatórios, restrições, atualizações, tempo de bloqueio da tela): no Intune isso
  fica em **perfis de configuração** e **atribuições de apps do Google Play gerenciado**, que são recursos diferentes da
  política de conformidade. Os nomes exatos no Graph para Android totalmente gerenciado **ainda não foram conferidos**
  e ficam para a próxima etapa, se a opção escolhida exigir.

## 5. Acesso, licença e limites
- **Licença:** a API do Intune no Graph “exige licença ativa do Intune no tenant”. A Microsoft diz que é preciso licença
  para “qualquer usuário ou aparelho que se beneficie, direta ou indiretamente”, **inclusive por API**. Aparelhos
  dedicados (sem usuário) podem usar licença **só de aparelho**. Quais planos do Microsoft 365 incluem o Intune deve
  ser conferido na página de preços da Microsoft para a assinatura da empresa (não confirmado aqui).
- **Teste gratuito:** a Microsoft oferece um teste do Intune, que inclui o EMS. Ainda não foi usado.
- **Permissões do aplicativo no Entra:**
  - comandos (wipe, remoteLock, rebootNow): `DeviceManagementManagedDevices.PrivilegedOperations.All`, delegada ou de
    aplicativo;
  - inventário: `DeviceManagementManagedDevices.Read.All`;
  - cadastro: `DeviceManagementServiceConfig.ReadWrite.All` (permissão **a conferir** na página do recurso).
- **Limites:**
  - **400** escritas e **4.000** requisições a cada 20 s por tenant, e **200** escritas a cada 20 s por aplicativo, para
    os recursos de aparelho;
  - wipe: 500 por dia por tenant;
  - ações em lote no portal: 100 aparelhos;
  - o DW Solutions já limita lotes a 500 e pede o 2º admin.
- **Aprovação múltipla do próprio Intune:** o Intune tem políticas de acesso que exigem que um 2º admin aprove o wipe.
  Se a empresa ativar, o wipe pedido pelo DW Solutions fica pendente também no Intune.

## 6. Leitura honesta
- **Cobre o CP4:** bloquear, reiniciar e apagar, inventário com horário, conformidade e cadastro por QR (este no /beta).
- **Não cobre:** modo perdido e limpar dados de app no Android. Essas ações **não podem aparecer como disponíveis** no
  modo real.
- Bateria e rede somem do inventário real.
- Bloquear só protege se o aparelho tiver senha. Como a senha é só monitorada (CP6-7), o painel precisa avisar isso no
  diálogo de bloquear.

## Fontes
- [Ações de aparelho por plataforma](https://learn.microsoft.com/en-us/intune/device-management/actions/)
- [Wipe](https://learn.microsoft.com/en-us/intune/device-management/actions/wipe)
- [Remote lock](https://learn.microsoft.com/en-us/intune/device-management/actions/remote-lock)
- [Restart](https://learn.microsoft.com/en-us/intune/device-management/actions/restart)
- [Localizar](https://learn.microsoft.com/en-us/intune/device-management/actions/locate)
- [Modo perdido](https://learn.microsoft.com/en-us/intune/device-management/actions/lost-mode)
- [managedDevice (Graph v1.0)](https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-manageddevice?view=graph-rest-1.0)
- [wipe (Graph v1.0)](https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-wipe?view=graph-rest-1.0)
- [actionState](https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-actionstate?view=graph-rest-1.0)
- [androidDeviceOwnerEnrollmentProfile (/beta)](https://learn.microsoft.com/en-us/graph/api/resources/intune-androidforwork-androiddeviceownerenrollmentprofile?view=graph-rest-beta)
- [Ações para não conformidade](https://learn.microsoft.com/en-us/intune/device-security/compliance/configure-noncompliance-actions)
- [Licenças do Intune](https://learn.microsoft.com/en-us/intune/fundamentals/licensing)
- [Limites de requisições do Graph](https://learn.microsoft.com/en-us/graph/throttling-limits)
