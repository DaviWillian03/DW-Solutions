# CHECKPOINT 4 — Escopo do primeiro MVP (proposta, 2026-10-23)

**Objetivo do MVP:** cumprir o critério de sucesso do prompt-mestre §0 — aplicação local com autenticação,
banco persistente, visão geral, gestão de empresas/lojas/usuários/aparelhos, **simulador realista**, políticas
versionadas, **fila de comandos com estados verificáveis**, auditoria, testes automatizados e documentação.
Tudo em **modo simulador** (ADR-0001). Itens ⏳ dependem das respostas do CHECKPOINT 4.

Esforço relativo em pontos (1 = trivial · 2 · 3 · 5 · 8 = grande). Não é estimativa de prazo.

## 1. Backlog MoSCoW

### Must — obrigatório no MVP
| ID | Item | Pts | Critérios de aceite (resumo) |
|----|------|-----|------------------------------|
| M1 | Fundação: monorepo, CI, script de setup do container, health checks | 3 | `pnpm test` e CI verdes; `/health` responde banco e Redis; setup idempotente |
| M2 | Banco: Drizzle, migrações, RLS por empresa, seeds sintéticos | 5 | sem `app.tenant_id` ⇒ 0 linhas; testes de leitura/escrita cruzada falham como esperado |
| M3 | Autenticação: login, sessão, logout, TOTP, passkey, códigos de recuperação, rate limit | 8 | admin não acessa nada sem MFA; sessão revogada some; 6 tentativas erradas ⇒ bloqueio temporário |
| M4 | Área da plataforma: criar/suspender empresa, convidar 1º admin, recuperar acesso | 3 | papel de plataforma não lê dados de empresa (teste no banco); ações auditadas e visíveis à empresa |
| M5 | Organização: lojas/filiais, departamentos, usuários, convites, papéis ⏳ e escopo por loja | 5 | supervisor da Loja A não vê aparelho da Loja B (API e UI); troca de loja remove permissões antigas |
| M6 | Simulador: `SimulatorProvider` com 100–500 aparelhos Samsung/Motorola, Android 12–15 | 8 | check-ins periódicos, aparelhos offline por dias, falhas e atrasos; nada aparece “ao vivo” sem leitura recente |
| M7 | Inventário: lista paginada no servidor, busca, filtros, seleção; página do aparelho em abas | 8 | 500 aparelhos com filtro < 300 ms no container; abas: visão geral, hardware, apps, políticas, conformidade, comandos, eventos |
| M8 | Atribuição e transferência de aparelho entre lojas/funcionários | 3 | histórico preservado; auditoria com motivo |
| M9 | Políticas: modelo declarativo, versões, diff, 4 modelos prontos, atribuição, validação de capacidade, conformidade simulada | 8 | versão nova nunca sobrescreve outra silenciosamente; atributo incompatível com modelo/Android aparece sinalizado |
| M10 | Comandos: fila com os 12 estados, idempotência, retry, expiração, cancelamento, aprovação dupla para sensíveis; comandos ⏳ | 8 | “confirmado pelo provedor” ≠ “aplicação verificada”; aparelho offline por 3 dias recebe ao voltar ou expira; quem pede não aprova |
| M11 | Auditoria append-only com hash encadeado + tela de consulta e filtros | 5 | alteração manual no banco é detectada pela verificação da cadeia |
| M12 | Visão geral (dashboard da referência aprovada) com dados do simulador e prioridades por impacto | 5 | todo número tem origem e horário; “desconhecido” separado de “sem sinal” |
| M13 | Matriz de capacidades (fabricante × Android × modo) com opção indisponível desabilitada e explicada | 3 | cada item rotulado com a classificação do §17 do prompt-mestre |
| M14 | Modo demonstração opt-in com faixa “DADOS SIMULADOS” | 2 | faixa visível em todas as telas quando ativo |
| M15 | Testes e relatório: isolamento, RBAC, estados de comando, E2E dos fluxos principais | contínuo | `docs/TEST_REPORT.md` com comandos e saídas reais |

**Total Must ≈ 74 pontos.**

### Should — desejável (entra no MVP só se escolhido ⏳)
| ID | Item | Pts |
|----|------|-----|
| S1 | Assistente de cadastro de aparelho com QR **“DEMONSTRAÇÃO — NÃO PROVISIONA DISPOSITIVO”** | 3 |
| S2 | Catálogo de aplicativos por nome de pacote + atribuição (simulada) | 5 |
| S3 | Exportação CSV do inventário com checagem de permissão | 2 |
| S4 | Rollout de política em etapas (piloto 1–5% → 10–25% → total), pausa e rollback quando possível | 5 |
| S5 | Tela de alertas completa (agrupamento, deduplicação, reconhecimento) | 5 |
| S6 | Busca global / paleta de comandos `Ctrl K` | 3 |

### Could — se sobrar fôlego
Incidentes com linha do tempo (5) · relatórios por loja/fabricante (5) · webhooks com HMAC (5) ·
ilustrações coloridas nos estados vazios (2) · `docker-compose.yml` para máquina local (1) · modo compacto de tabela (1).

### Won't now — fora do MVP (com motivo)
| Item | Quando |
|------|--------|
| Integração real com Android Management API | CHECKPOINT 6 (exige elegibilidade, quota e aparelho de laboratório) |
| App Android companheiro | Depois do CP6, se houver necessidade comprovada |
| Automações, IA, copiloto | CHECKPOINT 7 |
| Controle/visualização remota de tela | Projeto separado (APIs OEM + consentimento) |
| Integração ERP/CRM/PDV | Após MVP, com contrato/credencial |
| Quiosque real, OEMConfig, Knox | CP6+ (depende de fabricante e licença) |
| Localização/GPS | Somente modo perdido em aparelho corporativo, se suportado (CP6+) |
| COPE/BYOD | Fora do escopo (CP0-2) |

## 2. Mapa de telas do MVP
**Acesso:** Entrar · Verificação em duas etapas (app/chave de acesso/código de recuperação) · Aceitar convite e
cadastrar MFA · Sessões e segurança da conta.
**Empresa (menu no topo):** Visão geral · Aparelhos (lista) · Aparelho (abas) · Lojas e equipes · Usuários e
papéis · Políticas (lista) · Política (editor, versões, diff, atribuição) · Comandos (fila e aprovações) ·
Alertas (resumo; completo se S5) · Mais ▸ Auditoria · Configurações.
**Plataforma (área separada):** Empresas (criar, suspender, convidar admin, recuperar acesso) · Auditoria da plataforma.

## 3. Fluxos principais (viram testes E2E)
1. **Primeiro acesso:** plataforma cria empresa → convite → admin define senha → **cadastra MFA obrigatório** → Visão geral.
2. **Caixa parado:** Visão geral → prioridade “3 PDVs sem sinal” → aparelho → histórico de comunicação → comando
   “Bloquear tela” → acompanha *aguardando aparelho* → *confirmado pelo provedor* → *aplicação verificada*.
3. **Nova política:** modelo “Loja/PDV” → ajustar senha/atualizações → validação de capacidade → diff com a versão
   atual → atribuir à Loja Centro → conformidade por aparelho.
4. **Troca de loja:** transferir aparelho e funcionário → permissões antigas removidas → auditoria com motivo.
5. **Comando sensível:** suporte solicita → outro administrador aprova com justificativa → execução no simulador
   (negado se o mesmo usuário tentar aprovar).

## 4. Dados simulados padrão
250 aparelhos (configurável 100–500), 4 locais (2 lojas, 1 depósito, 1 equipe externa), modelos Samsung Galaxy
A/Tab Active e Motorola moto g, Android 12–15, cenários: loja sem energia, app que falha ao instalar, aparelho
sem leitura inicial, aparelho offline há dias, patch de segurança atrasado.
