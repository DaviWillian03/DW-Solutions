# CHECKPOINT 4 — Escopo do primeiro MVP (v2 simplificada, APROVADA em 2026-10-23)

> **v1 descartada por orientação do usuário:** “o foco do sistema é somente colocar smartphones em um
> gerenciamento MDM […] é um smartphone que será usado para **vendas e merchandising** principalmente.”
> A v1 (lojas, PDV, impacto operacional, área de plataforma com telas, 4 perfis) foi reduzida abaixo.

## Objetivo
Colocar os **smartphones de vendedores e promotores de merchandising** sob gerenciamento: cadastrar o aparelho,
saber quem está com ele, aplicar uma política simples, acompanhar se está conforme e agir remotamente quando
necessário. Tudo em **modo simulador** (ADR-0001). Os requisitos de segurança do prompt-mestre continuam valendo,
mas sem telas e módulos além do necessário.

## Escopo do MVP
| ID | Item | O que entrega | Pts |
|----|------|---------------|-----|
| M1 | Fundação | monorepo, CI, script de setup do container, `/health` | 3 |
| M2 | Banco | Drizzle + PostgreSQL com RLS por empresa (estrutura pronta, uma empresa de demonstração), seeds | 5 |
| M3 | Login | senha + MFA (app autenticador e chave de acesso) + códigos de recuperação, sessão, logout | 8 |
| M4 | Perfis | **Administrador** (tudo) e **Leitura** (só consulta), checados no backend | 2 |
| M5 | Cadastro de aparelho | assistente com QR **“DEMONSTRAÇÃO — NÃO PROVISIONA DISPOSITIVO”**; aparelho entra no simulador | 3 |
| M6 | Simulador | aparelhos Samsung/Motorola, Android 12–15, check-ins, aparelho sem sinal por dias, falhas | 5 |
| M7 | Aparelhos | lista com busca/filtros e página do aparelho: dados, **responsável**, política, conformidade, comandos, histórico | 5 |
| M8 | Política | 2 modelos prontos — **Vendas** e **Merchandising** — com senha/bloqueio de tela, apps obrigatórios, bloqueios básicos (fontes desconhecidas, depuração USB, redefinição de fábrica), atualizações; versões com comparação | 5 |
| M9 | Conformidade | por aparelho: conforme / não conforme / desconhecido, com motivo e horário | 2 |
| M10 | Comandos | **bloquear, reiniciar, modo perdido, limpar dados de app, apagar aparelho (wipe)** com estados verificáveis (aguardando aparelho → confirmado pelo provedor → aplicação verificada / falhou / expirou) | 8 |
| M11 | Auditoria | quem fez o quê, quando e por quê; lista com filtros; registro à prova de alteração | 3 |
| M12 | Visão geral | total, com sinal, sem sinal, desconhecido, fora da política, comandos pendentes, aparelhos que precisam de atenção | 3 |
| M13 | Testes | isolamento entre empresas, perfis, estados de comando, E2E dos 4 fluxos; `TEST_REPORT.md` | contínuo |

**Total ≈ 52 pontos** (v1: 74).

### Regras dos comandos (todos só afetam o simulador)
- **Bloquear / reiniciar:** um clique + confirmação.
- **Modo perdido / limpar dados de app:** justificativa obrigatória + confirmação com o nome do aparelho; aviso
  de que dados não sincronizados (ex.: pedidos, fotos) podem ser perdidos.
- **Apagar aparelho (wipe):** desligado por padrão nas configurações. **1 aparelho:** o admin confirma digitando
  o nome do aparelho e **refaz o MFA**. **Vários de uma vez:** exige aprovação de um **segundo admin** (quem
  pede não aprova). Tentativas negadas também são auditadas.
- Nenhum comando aparece como concluído sem “aplicação verificada”.

## Telas
Entrar · Verificação em duas etapas · Visão geral · Aparelhos · Aparelho · Cadastrar aparelho (QR demo) ·
Políticas (Vendas, Merchandising) · Comandos · Auditoria · Configurações (conta, MFA, usuários).
Criação de empresa e do primeiro administrador: **script de linha de comando**, sem tela (ADR-0005 mantido).

## Fluxos (viram testes E2E)
1. Admin entra pela primeira vez e cadastra MFA.
2. Cadastra um aparelho novo, define o responsável (vendedor) e aplica a política Vendas.
3. Vê aparelho não conforme e entende o motivo.
4. Celular perdido: ativa modo perdido → se não for recuperado, apaga o aparelho (com a regra de aprovação).

## Fora do MVP
Lojas/PDV, quiosque, departamentos, perfis além de Admin/Leitura, tela da plataforma, catálogo de apps,
exportação CSV, rollout em etapas, alertas avançados, incidentes, relatórios, webhooks, integração Android real
(CHECKPOINT 6), IA/automações (CHECKPOINT 7), app no celular, localização/GPS.
