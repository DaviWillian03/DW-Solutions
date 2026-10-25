# Estudo — rota com MDM de terceiros (rota B, 2026-10-25)

> **Decidido em 2026-10-25 (B-4):** Microsoft Intune. Pesquisa detalhada em `docs/android/INTUNE.md`; ADR-0010.

**Para quê:** se a empresa for usar o DW Solutions **só internamente** (CP6-3/4), a Android Management API não se
enquadra. A alternativa é a empresa contratar um MDM que já é EMM validado pelo Google, e o DW Solutions virar um
**painel por cima** dele, via API do fornecedor (`ExternalMdmProvider`, previsto no ADR-0001). Nada foi contratado.

## O que muda para o DW Solutions
- O que já existe continua: telas, perfis, responsáveis, políticas Vendas/Merchandising, comandos com estados,
  aprovação dupla, auditoria. Muda só o “provedor” que fala com os aparelhos.
- Cada fornecedor tem seus próprios nomes, limites e estados — o mapeamento precisa da documentação dele, e alguns
  passos (ex.: “aplicação verificada”) podem não existir: o painel mostra só o que o fornecedor confirma.
- Custo: licença do MDM por aparelho/usuário, paga pela empresa. Hospedagem do DW Solutions continua no CP8.

## Comparação (verificar preço e API direto com o fornecedor antes de decidir)
| MDM | API para o DW Solutions | Comandos que nos interessam | Custo indicado | Confiança da informação |
|-----|-------------------------|-----------------------------|----------------|--------------------------|
| **Microsoft Intune** | Microsoft Graph (`managedDevice`: wipe, remoteLock, rebootNow, retire…), exige licença Intune no tenant e permissão `DeviceManagementManagedDevices.PrivilegedOperations.All` | Bloquear, reiniciar, apagar; modo perdido e limpar dados de app a confirmar para Android | Por usuário (licença Microsoft) | **Oficial** para os endpoints ([Microsoft Learn](https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-manageddevice)); comportamento específico de Android totalmente gerenciado não confirmado; enum de ações em /beta |
| **Google Workspace (gerenciamento de endpoints)** | Admin SDK Directory `mobiledevices.action` | Só aprovar, bloquear, apagar conta/aparelho — **sem bloquear tela nem reiniciar** | Incluído em edições do Workspace | **Oficial** ([referência](https://developers.google.com/admin-sdk/directory/reference/rest/v1/mobiledevices/action)); limitado demais para o CP4 |
| **Esper** | API REST e SDK como foco do produto | A confirmar | Plano gratuito até 100 aparelhos anunciado em ~2020; listagens 2026 citam a partir de US$ 2/mês | **Não oficial / possivelmente desatualizado** ([Capterra](https://www.capterra.com/p/180690/Esper/)) |
| **Hexnode** | API no plano Pro (segundo a central de ajuda) | A confirmar | ~US$ 5,50/aparelho/mês (comparativo de terceiros, jul/2026) | Misto ([Hexnode](https://www.hexnode.com/mobile-device-management/help/what-are-the-pricing-plans-of-hexnode/), [AIMultiple](https://aimultiple.com/de/mobile-device-management-pricing)) |
| **ManageEngine MDM Plus** | API REST existe; acesso no plano gratuito não confirmado | Bloquear/apagar listados; no Android podem valer só para o perfil de trabalho | Grátis até 25 aparelhos | Misto ([comparativo oficial](https://manageengine.com/mobile-device-management/mdm-android-feature-comparison.html)) |
| **Miradore / Scalefusion** | Não confirmado | A confirmar | Miradore grátis até 50 (limitado); Scalefusion a partir de ~US$ 2 | **Não oficial**, valores conflitantes ([CostBench](https://costbench.com/software/mdm/miradore/free-plan/), [G2](https://www.g2.com/compare/logmein-miradore-vs-scalefusion)) |
| **Headwind MDM** (código aberto) | “REST API” anunciada; um desenvolvedor relatou problemas e acessou o banco direto | Agente próprio (launcher como dono do aparelho), não é Android Enterprise do Google | Software grátis (Apache 2.0); precisa de **servidor próprio** | Fabricante + relatos ([h-mdm.com](https://h-mdm.com/startups/), [Medium](https://medium.com/@andersonk/how-i-built-openmdm-an-open-source-mdm-sdk-born-from-real-world-necessity-7ae3e3b0f953)) |

## Leitura honesta
- **Melhor documentado:** Intune (Microsoft Graph). Faz sentido se a empresa já usa Microsoft 365.
- **Mais barato para testar:** Headwind (sem licença), mas exige servidor e foge do Android Enterprise; serve mais
  para laboratório do que para produção.
- **Google Workspace sozinho não cobre o CP4** (sem bloquear tela/reiniciar pela API).
- Esper, Hexnode, ManageEngine, Miradore e Scalefusion: **pedir documentação da API e preço oficial** antes de
  qualquer decisão; nada aqui deve ser tomado como garantido.
- Em todos: “apagar” continua seguindo a regra do CP4 no DW Solutions (nome + MFA; vários com 2º admin).
