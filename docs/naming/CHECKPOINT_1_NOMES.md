# CHECKPOINT 1 — Pesquisa de nomes (2026-10-23)

> **Resultado:** o usuário escolheu **“DW Solutions”** como nome da empresa, marca e sistema
> (ver CP1-1 em `docs/PRODUCT_DECISIONS.md`). Os candidatos abaixo ficam como registro histórico.

## Método e limites
- **Domínios:** consulta RDAP pública (registro.br para `.com.br`, Verisign para `.com`, Google Registry
  para `.app`). `404` = não registrado no momento da consulta; `200` = registrado. Disponibilidade
  muda a qualquer momento; **nenhum domínio foi registrado ou comprado** (orçamento R$ 0, CP0-6).
- **Marcas/conflitos:** busca na web por empresas/produtos de software com o mesmo nome ou nome parecido.
- **NÃO VERIFICADO:** base do INPI (exige consulta interativa) e bases do USPTO/EUIPO de forma
  sistemática. Antes de qualquer uso comercial, fazer busca formal no INPI nas classes 9 e 42.
- **Regra Google:** não usar “Android”, “Droid” ou “Andro-” no nome do produto; a forma descritiva
  “para Android” é a adequada.

## Candidatos viáveis

| Nome | Pronúncia | Lógica | .com.br | .com | .app | Conflitos encontrados | Risco |
|------|-----------|--------|---------|------|------|-----------------------|-------|
| **Frotalis** | fro-TÁ-lis | “frota” + sufixo latino: a frota de aparelhos sob gestão | livre | livre | livre | nenhum resultado na web | Baixo — mas “frota” lembra gestão de veículos |
| **Leme** | LÉ-mi | leme do barco: dá direção sem vigiar | ocupado (`lememdm.com.br` livre) | ocupado | ocupado | cidade Leme/SP; nenhum MDM | Médio — palavra comum, marca mais difícil de proteger |
| **Lemvia** | lem-VÍ-a | leme + via: direção e caminho | livre | ocupado | ocupado | “Lemvi Strategies” (Suíça, área não relacionada) | Baixo |
| **Quilha** | KÍ-lha | quilha do barco: estabilidade da operação | ocupado (`quilhamdm.com.br` livre) | ocupado | livre | nenhum | Baixo — “lh” difícil para estrangeiros |
| **Zelo** | ZÊ-lu | cuidado e diligência; gestão responsável | ocupado | ocupado | ocupado | **Zello** (app push-to-talk usado por equipes de campo), Zaelo, Grupo Zelo | Alto — som parecido no mesmo público |
| **Prumo** | PRÚ-mu | fio de prumo: tudo alinhado e conforme | ocupado | ocupado | ocupado | Prumo Logística (grande empresa brasileira), agência Prumos, programa Prumo do IPT | Alto — nome já forte no mercado |
| **Orlava** | or-LÁ-va | “orla”, a borda: gestão onde a operação acontece | livre | ocupado | livre | nenhum relevante | Baixo — significado pouco intuitivo |
| **Nodalis** | no-DÁ-lis | “nó”: cada aparelho é um nó da rede | livre | ocupado | ocupado | marca NODALIS (aparelhos telefônicos, S.I.T. Telecomunicazioni); pacote NuGet “Nodalis PLC engine” | Médio — classe de telecom próxima |

## Descartados pela pesquisa
- **Tessela** — marca **TESSELLA** registrada para software (Tessella Ltd., hoje Capgemini).
- **Fleetora** — muito próxima de **FleetOR** e **Fleetara** (software de gestão de frotas).
- Palavras comuns como Cerne, Trama, Mosaico, Esteio, Aldrava e Custódia: todos os domínios ocupados.

## Verificação de “DW Solutions”
| Domínio | Situação |
|---------|----------|
| dwsolutions.com.br | ocupado |
| dwsolutions.com | ocupado |
| dwsolucoes.com.br / .com | ocupados |
| dwsolucoes.app | livre |
| dwleme.com.br / .com | livres |

Conflitos: DWU IT Solutions (Porto Alegre), DW Practice (EUA), Digital Watchdog (sigla DW em
vigilância). Nenhuma “DW Solutions” encontrada no Brasil. INPI não verificado.

## Fontes
- https://www.sap.com/partners/profile/dwu-it-solutions
- https://en.wikipedia.org/wiki/DW_Practice
- https://digital-watchdog.com/posts/Definition-DW-Complete-Surveillance-Solutions
- https://trademarks.justia.com/owners/tessella-ltd-4065458
- https://en.wikipedia.org/wiki/Tessella
- https://www.trustradius.com/products/fleetor/reviews
- https://apps.apple.com/mx/app/fleetara/id6752526326
- https://www.b2bstack.com.br/product/zello
- https://www.baguete.com.br/noticias/prumos-e-insoft4-vencem-mpe-brasil
- https://packages.nuget.org/profiles/montgomerytech
- https://trademarks.justia.com/browse-by-serial-number/78/01/91
