# Decisões de Produto — Fonte da Verdade

Formato: ID · pergunta · opções · decisão · motivo · data · consequências · reversível?
Status possíveis: `ABERTA`, `DECIDIDA`, `SUBSTITUÍDA`.

## Preferências de colaboração

| ID | Decisão | Data |
|----|---------|------|
| P-001 | Todas as decisões são apresentadas como **múltipla escolha** (opções clicáveis com recomendação marcada); o usuário pode responder livremente em “Outro”. | 2026-10-23 |

## Decisões gerais

| ID | Assunto | Decisão | Data | Reversível? |
|----|---------|---------|------|-------------|
| D-000 | Nome de trabalho | ~~“Projeto MDM” até o CHECKPOINT 1~~ — SUBSTITUÍDA por CP1-1 | 2026-10-23 | — |
| D-001 | Plataforma-alvo | Somente Android; sem módulo iOS | 2026-10-23 | Não previsto |
| D-002 | Documento de referência | `docs/PROMPT_MESTRE.md` é a especificação base | 2026-10-23 | Sim, por nova decisão |

## CHECKPOINT 0 — Viabilidade, intenção e ambiente (DECIDIDO em 2026-10-23)

### CP0-1 · Finalidade — DECIDIDA
- **Opções:** estudo + visão comercial · MDM comercial/SaaS · uso interno de uma empresa.
- **Decisão:** projeto de **estudo/portfólio com visão comercial futura**.
- **Motivo:** permite construir o software completo sem depender de aprovação do Google; mantém aberta
  a rota AMAPI (que exige ser fornecedor comercial de EMM).
- **Consequências:** desenvolvimento 100% no `SimulatorProvider`; arquitetura multiempresa desde o
  início; **não** integraremos AMAPI até haver enquadramento comercial real, contrato com cliente e
  quota aprovada (CHECKPOINT 6). Ver ADR-0001.
- **Reversível:** sim — vira “MDM comercial” quando houver cliente/empresa.

### CP0-2 · Propriedade dos aparelhos — DECIDIDA
- **Opções:** 100% corporativos · mistos (COPE) · inclui BYOD.
- **Decisão:** **100% corporativos** — Fully Managed (vendedores) + Dedicated/quiosque (PDV, estoque).
- **Consequências:** modos COPE/BYOD ficam fora do MVP (aparecem como “Não suportado nesta versão”
  na matriz); menor superfície de risco LGPD.
- **Reversível:** sim, com novo modelo de privacidade para perfil de trabalho.

### CP0-3 · Fabricantes/versões — DECIDIDA
- **Opções:** Samsung + Motorola 12+ · Samsung primeiro · qualquer GMS 10+ · inclui sem GMS.
- **Decisão:** **Samsung + Motorola, Android 12+, com GMS**.
- **Consequências:** simulador e matriz de capacidades começam com esses fabricantes; Knox/OEMConfig
  marcado “Depende do fabricante/licença”; aparelhos sem GMS fora do escopo inicial.

### CP0-4 · Frota — DECIDIDA
- **Opções:** até 500 · 500–5.000 · mais de 5.000 · não sei.
- **Decisão:** **até 500 aparelhos**.
- **Consequências:** compatível com a quota inicial da AMAPI; simulador gera 100–500 aparelhos;
  monólito modular + workers é suficiente; paginação server-side mesmo assim.

### CP0-5 · Ambiente de desenvolvimento — DECIDIDA
- **Decisão:** desenvolvimento **somente via Claude Code na nuvem**; o usuário tem Git + VS Code e
  Android Studio; **sem Docker local** e **sem aparelho de teste resetável** por enquanto.
- **Ambiente verificado no container (2026-10-23):** Node 22.22, pnpm 10.28, PostgreSQL 16.15
  (binários do servidor), Redis 7.0.15, 4 CPUs, 15 GiB RAM. Docker CLI presente, daemon parado.
- **Consequências:**
  - O container é efêmero: todo setup deve ser **reproduzível por script** (SessionStart hook) e todo
    trabalho commitado e enviado à branch ao fim de cada etapa.
  - Testes de integração usam PostgreSQL/Redis nativos do container; `docker-compose.yml` será mantido
    para quem rodar localmente no futuro, mas não é obrigatório aqui.
  - O usuário verá as telas por **screenshots (Playwright)** e/ou páginas publicadas para revisão, pois
    não há navegador apontando para o servidor do container.
  - Integração com aparelho real (CHECKPOINT 6) bloqueada até existir aparelho resetável de laboratório.

### CP0-6 · Orçamento/hospedagem — DECIDIDA
- **Opções:** R$ 0 local · até R$ 100/mês · empresarial · on-premise.
- **Decisão:** **R$ 0 — sem serviços pagos**.
- **Consequências:** nenhuma conta cloud, domínio ou serviço será contratado; hospedagem rediscutida no
  CHECKPOINT 3/8.

### CP0-7 · MDM/APIs existentes — DECIDIDA
- **Opções:** nenhum · MDM de terceiros · projeto GCP · AMAPI aprovada.
- **Decisão:** **nenhum**.
- **Consequências:** modo simulador; nenhuma credencial real; `AndroidManagementProvider` apenas como
  contrato/esqueleto documentado até elegibilidade.

## CHECKPOINT 1 — Identidade de produto (DECIDIDO em 2026-10-23)

Pesquisa completa: `docs/naming/CHECKPOINT_1_NOMES.md`.

### CP1-1 · Nome — DECIDIDA
- **Opções apresentadas:** Frotalis (recomendado), Leme, Lemvia, Quilha, Orlava, Nodalis, Zelo, Prumo;
  depois: empresa + produto em PT (recomendado: “DW Leme”), produto = DW Solutions, DW Soluções.
- **Decisão do usuário (resposta livre):** **“DW Solutions”** é o nome geral de tudo — empresa, marca e
  sistema. Não haverá nome de produto separado.
- **Pesquisa:** nenhuma empresa “DW Solutions” encontrada no Brasil; nomes próximos: DWU IT Solutions
  (Porto Alegre, parceira SAP), DW Practice (EUA). “Digital Watchdog” usa a sigla DW em câmeras de
  vigilância (associação a evitar na comunicação visual). `dwsolutions.com.br` e `dwsolutions.com`
  **registrados por terceiros**; nenhum domínio comprado. **INPI NÃO VERIFICADO.**
- **Consequências:** substituir “Projeto MDM” por “DW Solutions” em código e docs; nomes técnicos de
  pacotes usam o prefixo `dw`. Domínio definitivo fica para o CHECKPOINT 8.
- **Reversível:** sim, até a publicação.

### CP1-2 · Posicionamento — DECIDIDA
- **Opções:** corporativo sóbrio (recomendado) · tecnológico premium · **acessível** · futurista.
- **Decisão:** **acessível** — simples e amigável, para empresas sem equipe grande de TI.
- **Consequências:** linguagem clara sem jargão na interface (termos técnicos com explicação), fluxos
  guiados, densidade de informação moderada, onboarding forte. Segurança continua inegociável.

### CP1-3 · Idioma da marca — DECIDIDA
- **Opções:** nome neutro + slogan PT (recomendado) · **tudo em português** · tudo em inglês.
- **Decisão:** **tudo em português** (slogan, interface, documentação, comunicação).
- **Observação registrada:** o nome “DW Solutions” é em inglês por escolha explícita do usuário (CP1-1);
  é a única exceção à regra do idioma.

## CHECKPOINT 2 — Design e identidade visual (DECIDIDO em 2026-10-23)

Material: `docs/design/CHECKPOINT_2_DIRECOES.md` e `docs/design/checkpoint-2/`.

### CP2-1 · Direção visual — DECIDIDA (resposta livre do usuário, 2026-10-23)
- **Opções apresentadas (rodada 1):** A Clareza · B Noturno · C Operação de loja (recomendada) · mistura A+C.
- **Decisão do usuário:** nenhuma das três. “Cor principal será **branca**, com **tons de azul diferentes**
  complementando; contraste moderno e **luxuoso**, mas **totalmente visível** em cada parte das telas.”
- **Consequências:** nova direção “Branco + azuis” com duas variações (D1 Azul Real, D2 Azul Gelo) na
  rodada 2; tipografia Plus Jakarta Sans (OFL); legibilidade WCAG AA obrigatória em todos os textos.
  Mantidos da rodada 1: cartões por loja, prioridades por impacto, estados distintos e faixa de simulação.

### CP2-2 · Tema — DECIDIDA
- **Opções:** seguir o sistema (recomendado) · só claro · escuro como padrão.
- **Decisão:** **seguir o sistema**, com troca manual pelo usuário. Escuro tem paleta própria validada.

### CP2-3 · Logotipo — DECIDIDA (estilo); variante pendente
- **Opções:** monograma DW (recomendado) · símbolo abstrato · só o nome · monograma + símbolo.
- **Decisão:** **monograma DW** (variante em CP2-6).

### CP2-4 · Navegação — DECIDIDA
- **Opções:** lateral agrupada (recomendada) · lateral só ícones · menu no topo.
- **Decisão:** **menu no topo** (abas horizontais + “Mais” para Auditoria e Configurações).
- **Consequências:** no celular/tela estreita, o menu vira botão “☰”; itens raros vão para “Mais”.

### CP2-5 · Variação — DECIDIDA
- **Opções:** D2 Azul Gelo (recomendada) · D1 Azul Real · mistura.
- **Decisão:** **D2 · Azul Gelo** — tudo branco, menu em pílulas, um cartão-destaque em degradê marinho → royal.

### CP2-6 · Monograma — DECIDIDA
- **Opções:** M1 Selo (recomendado) · M2 Traço contínuo · M3 Círculo.
- **Decisão:** **M2 · Traço contínuo** (degradê marinho → azure no claro; céu → branco no escuro).

### CP2-7 · Densidade — DECIDIDA
- **Opções:** equilibrada (recomendada) · espaçada · compacta · usuário escolhe.
- **Decisão:** **equilibrada**.

### CP2-8 · Animações — DECIDIDA
- **Opções:** sutis (recomendada) · nenhuma · expressivas.
- **Decisão:** **expressivas** (cascata, contadores, barras crescendo, brilho, elevação no hover).
- **Condição inegociável registrada:** respeitar “reduzir movimento” do sistema e nunca animar sucesso
  antes de confirmação real.

### CP2-9 · Slogan — DECIDIDA
- **Opções:** “Seus aparelhos em ordem…” (recomendado) · “…sem complicação” · “…em um só lugar” · “Controle claro…”.
- **Decisão (resposta livre):** **sem slogan**.

### CP2-10 · Ícone pequeno — DECIDIDA
- **Opções:** M2 sobre placa (recomendado) · M2 puro sempre · M1 só no ícone pequeno.
- **Decisão:** **M1 (Selo) apenas no favicon e ícone de app**; M2 em todo o resto (≥ 24 px).

### CP2-11 · Ilustrações — DECIDIDA
- **Opções:** traço azul leve (recomendado) · só ícones · coloridas.
- **Decisão:** **ilustrações coloridas**. Amostra de estilo será aprovada no CHECKPOINT 5.

### CP2-12 · Formatos do logo — DECIDIDA (parcial)
- **Decisão:** SVG, PNG claro/escuro, favicon e ícone de app — **gerados** em `docs/design/marca/`.
- O usuário marcou também “outro formato” sem especificar → pergunta aberta em `OPEN_QUESTIONS.md`.

**Resultado:** design system v1 em `docs/design/DESIGN_SYSTEM.md`.

## CHECKPOINT 3 — Arquitetura e implantação (DECIDIDO em 2026-10-23)

Proposta: `docs/architecture/CHECKPOINT_3_PROPOSTA.md`. ADRs 0002–0006 em `docs/adr/`.

| ID | Pergunta | Opções | Decisão | ADR |
|----|----------|--------|---------|-----|
| CP3-1 | Login/MFA | **Better Auth (rec.)** · Keycloak · gerenciado · do zero | **Better Auth embutido** | 0003 |
| CP3-2 | Isolamento entre empresas | **Banco único + RLS (rec.)** · filtro só no código · schema por empresa · banco por empresa | **Banco único + RLS** | 0004 |
| CP3-3 | ORM | **Drizzle (rec.)** · Prisma | **Drizzle** | 0004 |
| CP3-4 | Região dos dados | Brasil/SP (rec.) · decidir no CP8 · sem preferência | **Decidir no CHECKPOINT 8** | 0006 |
| CP3-5 | Formas de MFA | App + recuperação (rec.) · **app + chave de acesso** · e-mail | **App autenticador (TOTP) + passkey**, com códigos de recuperação | 0003 |
| CP3-6 | Admin da plataforma vê dados de clientes? | Só com autorização (rec.) · sempre com auditoria · **nunca** | **Nunca** — só cria/suspende empresa, convida 1º admin e recupera acesso, tudo auditado | 0005 |
| CP3-7 | Entrada de novas empresas | **Criadas pela plataforma (rec.)** · autocadastro · convite com aprovação | **Criadas pela plataforma** | 0005 |

Decisões técnicas delegadas (ADR-0002/0006): TypeScript 6, Node 22, pnpm workspaces, Next.js 16, NestJS 12,
Zod 4, BullMQ/Redis, pino, Vitest/Supertest/Playwright, ambiente sem Docker com PostgreSQL/Redis nativos,
CI GitHub Actions gratuita, `minimumReleaseAge` de 7 dias.

## CHECKPOINT 4 — Escopo do MVP (DECIDIDO em 2026-10-23)

Documento: `docs/product/CHECKPOINT_4_MVP.md` (v2 simplificada, aprovada).

| ID | Pergunta | Opções | Decisão |
|----|----------|--------|---------|
| CP4-1 | Foco do primeiro produto | inventário+políticas (rec.) · PDV/quiosque · segurança · comandos | **Resposta livre:** “somente colocar smartphones em um gerenciamento MDM […] usado para **vendas e merchandising**”. Escopo reduzido (v1 74 pts → v2 52 pts) |
| CP4-2 | Comandos no MVP | bloquear+reiniciar (rec.) · modo perdido · limpar dados de app · wipe | **Todos**: bloquear, reiniciar, modo perdido, limpar dados de app, wipe (só simulador) |
| CP4-3 | Perfis | 4 essenciais (rec.) · **só admin e leitura** · 7 perfis · personalizáveis | **Administrador e Leitura** |
| CP4-4 | Itens desejáveis | **QR demo (rec.)** · catálogo de apps · CSV · rollout | **Cadastro com QR de demonstração** |
| CP4-5 | Organização dos aparelhos | equipe+responsável (rec.) · **só responsável** · região+responsável | **Só responsável** (política escolhida por aparelho) |
| CP4-6 | Regra do wipe | **1 aparelho: admin + MFA (rec.)** · sempre 2 admins · admin sozinho | **1 aparelho: admin + nome + MFA novamente; vários: 2º admin aprova** |
| CP4-7 | Aprovação do escopo | **aprovado (rec.)** · ainda grande · falta algo | **Aprovado — iniciar Fase A** |

**Consequências:** sem lojas/PDV/quiosque/departamentos no MVP; criação de empresa por script (ADR-0005
mantido); a referência visual troca “cartões por loja” por “aparelhos que precisam de atenção”; políticas
Vendas e Merchandising. Simplificação reversível: a estrutura multiempresa e RLS continuam (ADR-0004).

## CHECKPOINT 5 — Revisão das primeiras telas reais (DECIDIDO em 2026-10-23)

Capturas avaliadas: `docs/design/telas-b/` (dados simulados).

| ID | Pergunta | Opções | Decisão |
|----|----------|--------|---------|
| CP5-1 | Telas da Fase B | **aprovadas (rec.)** · ajustar visão geral · ajustar lista/aparelho · ajustar visual | **Aprovadas** — ajustes finos podem vir junto com a Fase C |
| CP5-2 | Estados de comunicação | **manter (rec.)** · outros nomes · outro limite que 24 h | **Manter** “Com sinal” / “Sem sinal há +24 h” / “Desconhecido”, com horário da leitura |
| CP5-3 | Amostra de ilustração colorida | **junto com a Fase C (rec.)** · agora · não usar | **Junto com a Fase C**: 2 amostras aplicadas às telas vazias de Políticas, para aprovação |
| CP5-4 | “Outro formato” de logo (CP2-12) | **nenhum além dos atuais (rec.)** · PDF · redes sociais · timbrado | **Nenhum** — SVG, PNG, favicon e ícone de app bastam |

## Fim da Fase C (DECIDIDO em 2026-10-23)

| ID | Pergunta | Opções | Decisão |
|----|----------|--------|---------|
| C-1 | Amostras de ilustração A1/A2 | **aprovadas (rec.)** · mais simples · mais coloridas · não usar | **Aprovadas** — estilo oficial das telas vazias e de ajuda |
| C-2 | Limite padrão da idade do patch de segurança | **180 dias (rec.)** · 365 · 90 · sem limite | **180 dias** nas políticas prontas (editável por política) |
| C-3 | Próximo passo | **iniciar Fase D (rec.)** · ajustar telas · pausar | **Iniciar Fase D — comandos** |

Decisões técnicas da Fase C (delegadas): ADR-0007 (políticas versionadas, conflito 409, conformidade nunca presumida).

## Fase D — decisões técnicas delegadas (2026-10-23)

ADR-0008: estados verificáveis com histórico; 3 tentativas de envio; validade por tipo (24 h bloquear/reiniciar,
7 dias modo perdido, 72 h limpar dados, 30 dias apagar, 24 h aprovação); cancelamento só antes de o aparelho
receber; apagar desligado por padrão e ligado só com MFA; lote de apagamento com 2º admin; refazer MFA com limite
de 5 erros/15 min e código de uso único; modo perdido sem coleta de localização. Todas reversíveis — podem mudar
por decisão do usuário.

## Após a Fase D (DECIDIDO em 2026-10-23)

| ID | Pergunta | Opções | Decisão |
|----|----------|--------|---------|
| D-1 | Próximo passo | **tela de Auditoria (rec.)** · ajustar telas · CHECKPOINT 6 · pausar | **Tela de Auditoria (M11)** |
| D-2 | Prazos de validade dos comandos | **manter (rec.)** · mais curtos · mais longos | **Manter** (ADR-0008) |

Decisão técnica delegada (Fase E): auditoria visível **só para administradores** (contém IP e dados de acesso de
outras pessoas — minimização LGPD). Reversível: pode ser liberada ao perfil Leitura por decisão do usuário.

## CHECKPOINT 6 — Android real (DECIDIDO em 2026-10-25)

Documento: `docs/android/CHECKPOINT_6.md`. Fontes oficiais e não oficiais separadas.

| ID | Pergunta | Opções | Decisão |
|----|----------|--------|---------|
| CP6-0 | Auditoria para o perfil Leitura | **só admins (rec.)** · Leitura completa · Leitura sem IP | **Só administradores** (confirma decisão delegada da Fase E) |
| CP6-1 | Rota agora | **conector AMAPI pronto (rec.)** · laboratório Test DPC · pedir cota · só simulador | **Conector AMAPI “pronto para ligar”**, sem chamadas reais ao Google |
| CP6-2 | Aparelho de laboratório | não tenho · **tenho Samsung/Motorola 12+** · outro · comprar | **Tem Samsung/Motorola 12+ resetável** |
| CP6-3 | Enquadramento comercial | estudo/portfólio · CNPJ + piloto · **uso interno de uma empresa** | **Uso interno de uma empresa** — conflita com a AMAPI (proíbe uso exclusivamente interno) |
| CP6-4 | Relação desenvolvedor × empresa | vende/licencia · sistema da própria empresa · **não definido** | **Ainda não definido** — elegibilidade AMAPI depende disso |
| CP6-5 | Conector diante do conflito | **AMAPI + restrição documentada (rec.)** · MDM de terceiros · os dois | **AMAPI pronto + restrição documentada** |
| CP6-6 | Quando usar o aparelho de laboratório | depois do conector · agora · **não usar por enquanto** | **Não usar por enquanto** |
| CP6-7 | Senha de tela no Android real (Google bloqueia na hora e apaga em 10 dias por padrão) | exigir com prazos máximos · **só monitorar** · padrão do Google | **Só monitorar**: a regra de senha não é enviada; o DW Solutions mostra “não conforme” |
| CP6-8 | Versão mínima do Android (mesma regra padrão do Google) | **só monitorar (rec.)** · enviar com prazos máximos | **Só monitorar** |

**Consequências:** o conector nunca envia `passwordPolicies`, `minimumApiLevel` nem outra configuração com
bloqueio/apagamento automático por padrão; uma trava no código recusa essas chaves. A senha passa a ser
monitorada pelo relatório do aparelho. Nenhuma integração liga sem cota aprovada e decisão comercial (CP6-4).

| CP6-9 | Próximo passo enquanto o Android real espera CP6-4 | **revisão geral do MVP (rec.)** · rota MDM de terceiros · pausar | **Revisão geral do MVP** (celular, acessibilidade, textos) |

## Rota com MDM de terceiros (DECIDIDO em 2026-10-25)

Estudo: `docs/android/ROTA_MDM_TERCEIROS.md` (fontes oficiais e não oficiais separadas).

| ID | Pergunta | Opções | Decisão |
|----|----------|--------|---------|
| B-1 | Próximo passo após a revisão | segurança e operação · CP7 · **estudar MDM de terceiros** · pausar | **Estudar a rota com MDM de terceiros** |
| B-2 | Serviços que a empresa já usa | **Microsoft 365** · Google Workspace · já tem MDM · não sei | **Microsoft 365** — Intune (Microsoft Graph) é o candidato natural para uso interno |
| B-3 | O que fazer com o estudo | **registrar e pausar (rec.)** · conector Intune desligado · laboratório Headwind | **Registrar e pausar** até a empresa responder |
| B-4 | Provedor real | AMAPI (venda) · **Microsoft Intune (uso interno)** | **Microsoft Intune** (2026-10-25) — uso interno da empresa; `@dw/amapi` fica arquivado como referência (a AMAPI não permite uso exclusivamente interno) |

## Rota Microsoft Intune (DECIDIDO em 2026-10-25)

Pesquisa oficial: `docs/android/INTUNE.md`. Arquitetura: `docs/adr/0010-conector-intune-desligado.md`.

| ID | Pergunta | Opções | Decisão |
|----|----------|--------|---------|
| I-1 | Modo perdido e limpar dados de app (o Intune não tem no Android) | indisponível no real · **trocar por Localizar + som** · remover | **Modo perdido vira “Localizar aparelho” + “Tocar som”**. Limpar dados de app fica **indisponível no Intune** (aviso na tela), mantido no simulador |
| I-2 | Onde ficam as políticas | Intune configura, DW confere · **DW publica no Intune** | **DW publica no Intune** (perfil de configuração no Graph /beta + atribuição de apps) |
| I-3 | Licença que inclui o Intune | **não sei, vou conferir** · Business Premium · Basic/Standard · E3/E5 | **A conferir** — só Business Premium e E3/E5 incluem o Intune Plan 1; Basic/Standard não |
| I-4 | Quem cria o aplicativo no Entra | **TI da empresa, depois** · usuário em tenant de teste | **TI da empresa, depois** — passo a passo com permissões mínimas; chave só como segredo do ambiente |
| I-5 | Regras do Localizar | **só admin, motivo + MFA** · só admin, motivo · admin e Leitura | **Só admin, motivo escrito + MFA de novo**, sob demanda, auditado; coordenadas mostradas na hora e **não guardadas** no DW |
| I-6 | Última localização automática dos dedicados (Intune guarda 7 dias) | **desligar a coleta** · manter | **Desligar** (`locateDeviceUserlessDisabled`); aparelho dedicado não é localizável |
| I-7 | Como o aparelho entra na política no Intune | **TI cria os grupos, DW gerencia membros** · DW cria tudo | **TI cria 2 grupos de aparelhos** (Vendas, Merchandising); o DW só adiciona/remove membros |
| I-8 | Bloquear redefinição de fábrica (em Samsung, impede o APAGAR remoto de terminar) | **não enviar** · só Motorola · enviar mesmo assim | **Não enviar no Intune**; a opção aparece como “não enviada no Intune” |
| I-9 | Senha da tela no Intune (usa o app do Google por baixo; bloqueio automático não documentado) | **manter só monitorar** · exigir pelo Intune | **Mantém CP6-7**: nenhuma regra de senha vai ao Intune até prova em laboratório |

**Fatia I2 (2026-10-25):** “Ativar/Desativar modo perdido” não são mais oferecidos (o pedido é recusado com
explicação; o histórico continua). Entram **Localizar aparelho** (motivo + MFA, só totalmente gerenciado; a
localização aparece só para quem pediu, lida na hora no provedor, nunca gravada) e **Tocar som** (sem motivo nem
MFA, como bloquear). Na visão geral, o indicador “Em modo perdido” deu lugar a “Sem política”.

**Consequências:** o conector nunca envia regras de senha, nem “apagar após N tentativas”, nem o bloqueio de
redefinição; também recusa e denuncia políticas de conformidade do Intune com ação automática (`block`, `retire`,
`wipe`, `remoteLock`). Nada é ligado sem licença confirmada, aplicativo no Entra criado pela TI e teste em
laboratório (CP6-6).

## Custo zero (DECIDIDO em 2026-10-27)

| ID | Pergunta | Opções | Decisão |
|----|----------|--------|---------|
| R-1 | Gasto extra (licença, hospedagem, domínio) | — | **Fora de cogitação.** Só o que a empresa já paga ou é gratuito. Reforça a regra de orçamento R$ 0 |
| R-2 | Quantos celulares | **até 25** · mais de 25 · não sei | **Até 25** |
| R-3 | Plano Microsoft 365 | **vou conferir** · Business Premium · E3/E5 · Basic/Standard | **A conferir** |

**Consequências:**
- **Business Premium ou E3/E5:** Intune sem custo extra, que é a rota atual (ADR-0010). Os aparelhos dedicados
  podem exigir licença só de aparelho; a saída sem custo seria cadastrá-los como totalmente gerenciados, com
  responsável (a confirmar).
- **Basic/Standard:**
  - O “Basic Mobility and Security” grátis só apaga e aposenta, sem bloquear, reiniciar nem localizar, e o acesso
    pela API não está confirmado. Não serve para o CP4.
  - Candidato: **ManageEngine MDM Plus grátis** (até 25 aparelhos, certificado Android Enterprise). Falta confirmar
    se a API vem no plano grátis; sem API, o DW não consegue comandar.
  - Headwind MDM (código aberto) não serve: bloquear, reiniciar e apagar só existem na versão paga.
- **Hospedagem a R$ 0:** os celulares falam com a nuvem do provedor, não com o DW. Por isso o DW pode rodar num
  computador da empresa, acessado só pelos admins, com cópias de segurança no OneDrive que já vem no Microsoft 365.
  A decisão fica para o CHECKPOINT 8.
