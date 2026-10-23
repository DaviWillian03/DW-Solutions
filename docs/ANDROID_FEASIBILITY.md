# Viabilidade Android Enterprise (rascunho — CHECKPOINT 0)

Fontes oficiais consultadas em **2026-10-23**. Revalidar antes de qualquer integração real.
- https://developers.google.com/android/management/permissible-usage
- https://developers.google.com/android/work/play/emm-api/register

## Fatos verificados
- A Android Management API (AMAPI) é restrita a **desenvolvedores comerciais de EMM**, provedores de
  Device Trust e OEMs. O EMM precisa **vender a entidades externas e dar suporte direto** a elas,
  com acordo direto com o cliente final.
- Soluções “desenvolvidas e usadas exclusivamente para uso interno (first party)” **não** se
  enquadram.
- Proibido: monitoramento/vigilância desvinculado de gestão empresarial, financiamento que bloqueia
  aparelho por inadimplência, instalar apps sem consentimento expresso, aplicar políticas a
  aparelhos não gerenciados pelo EMM.
- Quota inicial de dispositivos: até **500**, mediante justificativa de negócio completa; acima
  disso, solicitação ao Android Enterprise. Quota de consultas padrão: 1.000 / 100 s por projeto;
  60 consultas/min por recurso. Máximo de 2 projetos com quota por desenvolvedor (dev e prod).
- A antiga Google Play EMM API **não aceita novos registros de DPC personalizado**; novos EMMs devem
  usar a AMAPI (DPC fornecido pelo Google — Android Device Policy).

## Rotas
| Rota | Quando faz sentido | Limitação principal |
|------|--------------------|---------------------|
| A. AMAPI comercial | Produto vendido a clientes externos | Elegibilidade, quota e validação; Google pode revogar |
| B. Portal próprio + MDM de terceiros | Uso interno de uma empresa | Capacidades limitadas às APIs licenciadas do fornecedor |
| C. DPC de laboratório (DevicePolicyManager/Test DPC) | Aprendizado e provas de conceito em aparelhos próprios | Não vira EMM Google Play comercial |
| Simulador | Sempre, enquanto nenhuma rota real estiver autorizada | Não gerencia aparelhos reais |

## Decisão (2026-10-23 — ADR-0001)
**Simulador agora; AMAPI (rota A) como destino comercial futuro**, somente com enquadramento comercial,
quota aprovada e aparelho de laboratório. Escopo inicial: aparelhos 100% corporativos (Fully Managed +
Dedicated), Samsung e Motorola com GMS, Android 12+, frota de até 500.
