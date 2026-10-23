# PROMPT-MESTRE — CONSTRUA MEU MDM ANDROID CORPORATIVO DO ZERO

> **Instruções para Claude Pro / Claude Code.** Você está recebendo a especificação inicial e as regras de colaboração de um projeto real. Leia integralmente antes de agir. O texto entre colchetes é uma decisão a solicitar ou registrar; não assuma que já foi respondida. Idioma de trabalho: português brasileiro. Data de referência da pesquisa: outubro de 2026; confira as documentações atuais antes de implementar integrações reais.

## 0. Papel, missão e critério de sucesso

Atue como uma equipe sênior integrada composta por: CTO/arquiteto de software, engenheiro especializado em Android Enterprise, engenheiro backend, engenheiro frontend, especialista DevSecOps, arquiteto de dados, designer de produto/UI/UX, QA/SRE, consultor de privacidade e product manager. Tome decisões técnicas fundamentadas, produza código de qualidade profissional, mas mantenha-me como decisor final sobre produto, experiência visual, escopo, custos, riscos e implantação.

**Objetivo:** cocriar comigo, a partir de um repositório vazio, uma plataforma WEB de Mobile Device Management (MDM), exclusivamente para smartphones e tablets **Android**, voltada sobretudo a empresas comerciais com vendedores, lojas, representantes, equipes de estoque e PDVs. Inspiração funcional: Microsoft Intune, SOTI MobiControl, Samsung Knox, Omnissa Workspace ONE, IBM MaaS360 e ManageEngine MDM. Não reproduza marcas, layouts proprietários ou código desses sistemas.

A solução deve administrar dispositivos Android empresariais, provisionar políticas e aplicativos, manter inventário, monitorar conformidade e saúde operacional, controlar permissões administrativas, auditar operações, suportar ações remotas autorizadas e integrar-se futuramente a ERP/CRM/PDV. O diferencial futuro será diagnóstico correlacionado, simulação de políticas, automação e IA supervisionada. O foco inicial é produzir uma **base funcional, testada e segura**, não apenas uma interface bonita ou uma demo estática.

**Critério de sucesso:** ao final das primeiras fases, executar localmente uma aplicação com autenticação, banco persistente, dashboard, gestão de empresas/unidades/usuários/dispositivos, simulador realista de gerenciamento, políticas versionadas, fila de comandos com estados verificáveis, auditoria, testes automatizados e documentação. Uma integração com aparelhos reais só será rotulada como concluída quando houver autorização, configuração válida, testes em hardware e provas registradas. Nunca confunda simulação, envio de API, recebimento de comando e confirmação de aplicação real.

## 1. Protocolo de colaboração: planejamento interativo obrigatório

Não comece gerando centenas de arquivos nem entregando uma arquitetura definitiva sem me envolver. Seu comportamento deve ser o de um desenvolvedor que **faz perguntas estratégicas em momentos específicos da construção**, apresenta opções, recomenda a melhor alternativa e registra minhas respostas. Pergunte somente o que altera uma decisão relevante: agrupe no máximo **5 a 7 perguntas por rodada**, use letras A/B/C sempre que útil e aceite respostas livres como “siga sua recomendação”. Não faça uma entrevista interminável antes de começar; intercale decisões, código executável e demonstrações. Não invente escolhas em meu nome. Quando faltar uma decisão que eu deva tomar, **PARE e aguarde a resposta**.

Formato de cada ponto de decisão:

**CHECKPOINT [n] — [assunto]**
- O que já foi decidido e implementado (com evidências).
- As 3 ou 4 opções reais, trade-offs, custos, riscos e sua recomendação explícita.
- As perguntas numeradas e curtas, indicando o que posso responder em uma linha.
- Quais trabalhos técnicos independentes podem continuar depois da minha decisão.
- **Não prossiga com a decisão bloqueada antes de eu responder.**

Mantenha `/docs/PRODUCT_DECISIONS.md` como fonte da verdade: ID, pergunta, opções, decisão, motivo, data, consequências e possibilidade de alteração. Crie `/docs/OPEN_QUESTIONS.md` e `/docs/ROADMAP.md`. Se estiver em Claude Code, crie `CLAUDE.md` curto com comandos, regras, convenções e links aos documentos; preserve contexto entre sessões em arquivos, não exclusivamente na conversa.

**Checkpoints obrigatórios e ordem sugerida:**

### CHECKPOINT 0 — Viabilidade, intenção e ambiente (ANTES do código)
Pergunte: (1) produto para uso exclusivo de uma empresa ou MDM comercial/SaaS para clientes externos? (2) propriedade dos dispositivos: 100% corporativos, mistos ou BYOD? (3) fabricantes prioritários (Samsung, Motorola, Xiaomi, outros) e faixa de versões Android? (4) tamanho previsto da frota inicial e futura? (5) ferramentas disponíveis: Claude Code, VS Code, sistema operacional, Docker, Git, Android Studio e aparelhos físicos de teste? (6) orçamento aproximado para infraestrutura/serviços e preferência cloud versus on-premise? (7) se já existe provedor MDM e acesso autorizado às APIs Google/terceiros? **Explique primeiro por que a escolha entre interno e comercial altera o caminho Android Enterprise.** Recomende padrão para cenário comercial: foco em Fully Managed/Dedicated, arquitetura preparada para multiempresa, integração oficial Android Management API sujeita à elegibilidade; se interno: uso de MDM comercial integrado quando necessário ou prova de conceito DPC local de laboratório, nunca presumindo direito de usar a AMAPI. Sem resposta, aguarde.

### CHECKPOINT 1 — Identidade de produto
Depois do estudo inicial de viabilidade, apresente **8 a 12 propostas originais de nomes**, com lógica, pronúncia, força de marca e riscos de confusão (se puder pesquisar, verifique marcas/domínios; se não, sinalize que não verificou). Pergunte nome preferido, posicionamento (corporativo sóbrio, tecnológico premium, acessível, futurista) e idioma da marca. Use nome provisório “Projeto MDM” até minha escolha. Nunca registre domínio/compre serviços sem autorização.

### CHECKPOINT 2 — Design e identidade visual
Proponha **3 direções visuais**: (A) enterprise minimal, (B) tech premium, (C) operational intelligence. Para cada uma informe paleta hexadecimal, tipografia com licença apropriada, densidade de informação, exemplos de componentes e estilo do dashboard. Pergunte: modo claro/escuro/padrão do sistema; cores principais; navegação sidebar ou outra; visual do logotipo (wordmark, monograma, símbolo abstrato, rede/dispositivo/escudo não genérico); formatos finais necessários (SVG, PNG, favicon e ícone de app); estilo das ilustrações; nível de animações; preferência por layout denso ou espaçado. Produza 2–3 protótipos navegáveis ou telas reais para comparação quando o ambiente permitir e peça aprovação **antes de cristalizar o design system**. Não alegue ter gerado logo vetor profissional sem produzir e validar o arquivo. Evite dependência de geradores de imagem se não houver ferramenta; SVG simples original é aceitável com aprovação.

### CHECKPOINT 3 — Arquitetura e implantação
Após explorar opções, recomende stack, arquitetura modular, prioridades de módulos, hospedagem, provedor de identidade, estratégia multiempresa, regiões de dados e custos iniciais estimativos claramente marcados. Pergunte as poucas decisões que importarem; detalhe o que fica configurável depois. Registre ADRs em `/docs/adr/`.

### CHECKPOINT 4 — Escopo do primeiro MVP
Mostre backlog priorizado MoSCoW (Must/Should/Could/Won't Now), fluxos de usuário, mapa de telas, estimativa relativa de esforço e critérios de aceite. Pergunte se primeiro produto deve priorizar inventário/políticas, suporte remoto permitido, kiosk/PDV ou segurança/compliance; recomende o menor MVP que já seja útil.

### CHECKPOINT 5 — Revisão das primeiras telas reais
Entregue app executável e exemplos com dados explicitamente simulados; peça feedback sobre painel, inventário, página do aparelho, políticas, clareza dos estados e linguagem visual. Ajuste antes de avançar para 20 telas.

### CHECKPOINT 6 — Inscrição/integração Android real
Somente depois do simulador e dos pré-requisitos legais/técnicos: confirmar elegibilidade/contrato, existência de credenciais, modelo de aparelho para homologação, se pode redefini-lo de fábrica, modo Fully Managed/Dedicated e política inicial segura. Nunca execute wipe, factory reset, mudança de propriedade ou bloqueio sem confirmação específica do operador autorizado e dispositivo de laboratório.

### CHECKPOINT 7 — Automações e inteligência
Ofereça regras prontas, correções sem perda de dados, simulador de consequências, sugestões de IA. Pergunte a ordem de implementação, políticas de aprovação e serviços externos aceitos. IA primeiro como assistente de consulta e explicação, depois como recomendadora. Ações sensíveis nunca automáticas por padrão.

### CHECKPOINT 8 — Piloto e publicação
Revisar threat model, LGPD, backups/restauração, permissões, testes de isolamento de tenants, observabilidade, custos reais, homologação, termos do Google e roteiro de rollout por canário. Pergunte e obtenha aprovação expressa antes de conectar produção, expor a internet ou usar dispositivos de terceiros.

**Regra de autonomia equilibrada:** decisões pequenas e reversíveis (nomes internos de variáveis, espaçamentos, organização de arquivos) podem ser tomadas por você. Decisões de negócio, privacidade, ações destrutivas, estilo de marca, custos, provedores e lançamento dependem da minha aprovação. Se eu disser “escolha por mim”, escolha, justifique e registre.

## 2. Primeira barreira: viabilidade e regras oficiais do Android

Antes de escolher a tecnologia de gerenciamento, **confirme a documentação vigente** e elabore `/docs/ANDROID_FEASIBILITY.md` contendo três estratégias comparadas:

**A. EMM comercial via Android Management API (AMAPI):** indicada quando houver enquadramento nas regras do Google. Integração backend com API REST Android Management, Android Device Policy do Google no aparelho, enterprise binding, enrollment tokens, QR code, políticas, managed Google Play, comandos e eventos Google Cloud Pub/Sub. Solicitação de cota, elegibilidade, validação e publicação são condições externas reais. Não use chaves de exemplo em produção.

**B. Plataforma própria para operação interna, integrada a um fornecedor MDM existente:** backend/portal próprios consumindo APIs oficialmente disponíveis e licenciadas do fornecedor (por exemplo, Intune/Knox/ManageEngine), mantendo nosso diferencial em dashboards, automações, diagnósticos e sistemas comerciais. Trate capacidades como variáveis do conector, sem prometer que todos os fornecedores possuem API para tudo.

**C. Laboratório de DPC próprio usando DevicePolicyManager, Test DPC e Android Enterprise dedicado:** útil para aprender, testar políticas em aparelhos próprios provisionados corretamente e construir provas de conceito. **Não** assuma que isso permite lançar novo EMM Google Play com DPC personalizado; novos registros na antiga Google Play EMM API não são aceitos. Valide rotas de aprovação ou suporte do fabricante antes de prometer implantação empresarial. DPC de laboratório e solução comercial são coisas diferentes.

Se o projeto escolhido for **apenas interno**, não integre a AMAPI diretamente ignorando as restrições de uso. Se o projeto for **comercial**, não afirme que já está aprovado ou que possui cota. Caso uma abordagem não seja elegível, use alternativa autorizada ou permaneça no **modo simulador** enquanto construímos o software.

**Suportar apenas Android; não criar módulo Apple/iOS.** Priorizar aparelhos Android com GMS quando a solução depender de Android Enterprise/Managed Google Play; documentar diferenças de AOSP sem GMS. Ter matriz de capacidades por fabricante, versão, modo (Fully Managed, Dedicated, COPE, BYOD), agente/conector e permissão; qualquer opção indisponível deve aparecer desabilitada com explicação verificável.

Nunca alegue poderes impossíveis: rastreamento GPS silencioso universal, controle remoto sem consentimento em qualquer versão, acesso a mensagens privadas, gravação de ligações, leitura de apps pessoais, acesso a identificadores restritos, instalação irrestrita ou bypass do setup de Device Owner. Recursos avançados de Samsung devem ser condicionais ao Knox/OEMConfig/licenças/hardware. **Não usar AccessibilityService para contornar controles, nem root/ADB em produção ou APIs privadas para obter privilégios.** Quando o usuário pedir algo incompatível, explicar e oferecer uma abordagem suportada.

## 3. Arquitetura técnica que deve ser proposta (com liberdade justificada)

Para acelerar desenvolvimento via vibe coding, recomendo **TypeScript end-to-end** com:
- Monorepo `pnpm` (e `Turborepo` somente se trouxer benefício concreto).
- **Frontend:** Next.js + TypeScript, Tailwind CSS, shadcn/ui ou componentes Radix acessíveis, TanStack Table e TanStack Query, biblioteca de gráficos enxuta, React Hook Form + Zod.
- **Backend:** NestJS com TypeScript, APIs REST bem documentadas por OpenAPI; módulos por contexto de negócio e validação forte.
- **Banco:** PostgreSQL, Prisma (ou Drizzle se houver justificativa técnica), migrations rastreáveis e índices por tenant, timestamps e estados.
- **Filas:** Redis + BullMQ, com deduplicação, retries com backoff, dead-letter strategy e idempotência quando aplicável.
- **Simulador/integrações:** abstração `DeviceManagementProvider` e provedores `SimulatorProvider`, `AndroidManagementProvider` (somente quando autorizado) e futuros `ExternalMdmProvider`; contratos e testes de conformidade de adaptadores.
- **Cloud quando necessário:** GCP Pub/Sub para notificações da AMAPI e infraestrutura gerenciada adequada; nunca substituir eventos reais por FCM arbitrário e afirmar que equivalem a confirmação da política.
- **Autenticação:** OIDC/OAuth2 robusto (Keycloak ou provedor gerenciado após minha escolha), MFA para administração e sessões seguras; ambiente local com login de desenvolvimento explicitamente não produtivo e sem senhas padrão publicadas. Preferir sessões HttpOnly SameSite Secure quando aplicável; proteção CSRF adequada.
- **Testes:** unitários (Vitest/Jest), integração (banco real em container), contrato, E2E Playwright, testes de autorização e isolamento multiempresa. K6 opcional para cargas.
- **Infra:** Docker Compose para desenvolvimento, configuração por `.env.example` sem segredos reais; pipeline CI com lint, typecheck, testes, SAST/dependency scanning e builds. Deployment futuro por IaC após aprovação.
- **Observabilidade:** OpenTelemetry, logs estruturados com correlation/request IDs, Prometheus/Grafana ou solução gerenciada, rastreamento e alertas.

Estas são propostas iniciais; confirme versões estáveis e compatibilidade no momento da implementação. **Não adicione Kafka, Kubernetes, serviços de IA caros ou dezenas de microsserviços na versão 1 sem demonstrar necessidade.** Prefira monólito modular + workers e interfaces claras para futura separação. Se minha máquina não suportar Docker, ofereça setup alternativo honesto.

## 4. Modelagem de domínio (primeiro ERD, depois migrações)

Defina modelos para: `Tenant/Organization`, `Location/Branch`, `Department`, `User`, `Role`, `Permission`, `UserRole`, `Device`, `DeviceAssignment`, `DeviceHardwareSnapshot`, `EnrollmentBatch`, `EnrollmentTokenMetadata`, `Policy`, `PolicyVersion`, `PolicyAssignment`, `PolicyComplianceResult`, `ManagedApplication`, `AppDeployment`, `DeviceCommand`, `ProviderOperation`, `ProviderEvent`, `Alert`, `Incident`, `AutomationRule`, `AutomationExecution`, `ApprovalRequest`, `AuditEvent`, `IntegrationConnection`, `WebhookDelivery`, `BusinessImpactMapping`, `Notification`, `CertificateMetadata`, `RiskSignal`, `SupportTicket`, `DataRetentionRule` e entidades adicionais somente quando houver caso de uso.

Exigir em dados empresariais: tenant_id, integridade referencial, exclusão segura, normalização razoável, índices, histórico de mudanças, e status com timestamps. Separar ID interno de resource name externo Google; não persistir token de inscrição em texto simples quando desnecessário; criptografar segredos, registrar validade, escopo, origem e revogação. Criar migrações reversíveis quando possível, seeds sintéticos e testes de integridade. Modelar `desired_state`, `observed_state` e `last_observed_at`: dado desatualizado jamais aparecerá como informação “ao vivo”. Estado desconhecido é diferente de offline, comprometido ou inconforme.

## 5. Capacidades obrigatórias: módulos e telas

### 5.1 Autenticação, organização e permissões
- Onboarding do administrador e setup seguro; recuperação de conta e sessões.
- Controle multiempresa preparado mesmo se a primeira implantação for single-tenant: tenant context obrigatório, restrições por filial, região e função, permissões por ação/recurso. Perfis exemplos: superadministrador de plataforma, admin da organização, segurança, suporte, supervisor de filial, auditor leitura e usuário de operação; aplicar menor privilégio.
- Administradores exigem MFA forte; impor autorização **no backend**, não apenas no frontend. Testes que tentem acessar objetos de outro tenant e filiais não autorizadas. Permitir aprovação dual e segregação de funções para comandos sensíveis.

### 5.2 Dashboard Executivo e de TI
- Indicadores: total gerenciado, com comunicação recente, sem comunicação (por janelas explícitas), não conformes, pendentes de atualização, apps com falha, incidentes por unidade, operações pendentes, resultado desconhecido, tendência temporal e distribuição por modelo/Android.
- Visões de status com carimbo de última atualização e origem do dado, filtros globais, drill-down clicável, empty states, skeletons, acessibilidade e exportação controlada. NÃO fabricar métricas de produtividade ou receita quando não houver integração ERP/CRM.
- Priorizar alertas por severidade + impacto operacional documentado, não usar só contagem de aparelhos.

### 5.3 Inventário e detalhes do aparelho
- Lista com pesquisa, paginação server-side, filtros e seleção em lote, identificação de ownership e modo gerenciado, fabricante, modelo, Android/security patch, serial/IMEI **somente se API permitir**, status, usuário responsável, loja, políticas, apps, histórico, incidentes.
- Página detalhada em abas: visão geral, hardware/capacidades, softwares, políticas, conformidade, eventos, comandos e suporte; linha do tempo auditável, origem e frescor da telemetria.
- Onboarding/offboarding, transferência entre lojas/funcionários, gestão de estoque de smartphones, atribuição de dispositivo reserva e substituição assistida sem presumir recuperação de dados não sincronizados.

### 5.4 Provisionamento
- Wizard por QR code/enrollment token nas modalidades permitidas, duração e vínculo organizacional, instruções claras para device setup; integração zero-touch apenas quando elegível e disponível.
- Informar requisitos de factory reset de forma visível; nunca disparar reset simplesmente porque o usuário abriu o wizard.
- Modo simulador com QR **claramente marcado “DEMONSTRAÇÃO — NÃO PROVISIONA DISPOSITIVO”** e sem token real; em modo real, expor apenas o QR gerado pelo provedor autorizado. Não prometer enrollment irrestrito em aparelhos já configurados.

### 5.5 Políticas e conformidade
- Editor visual com templates por funções: vendas externas, loja/PDV, estoque e quiosque; blocos para senha, bloqueio de tela, criptografia, atualização, Wi-Fi, VPN, apps obrigatórios, kiosk, restrições de compartilhamento e configurações OEM quando disponíveis.
- Criar modelo declarativo agnóstico com `policy_version`, `target`, `capabilities`, validação, diff e histórico. Transformar somente campos válidos para conector/Android/versionamento; sinalizar atributos não suportados; evitar conflito de políticas por precedência declarada e simulação de impacto.
- Rollout por etapas (piloto 1–5%, expansão 10–25%, total), pausas e rollback **somente nas políticas em que reversão é possível**. Não prometer rollback automático de SO ou dados de aplicativos.
- Regras default de non-compliance da AMAPI podem bloquear/apagar após atraso; avaliar `policyEnforcementRules` antes de liberar policy. **Nenhuma política de teste deve provocar wipe automático não intencional.** Exigir diff, aprovação e dry-run de planos de alto risco.
- Compliance status com `compliant`, `noncompliant`, `unknown`, `not_applicable`, timestamps, motivo e passos de correção verificáveis; exibir limitações de telemetria.

### 5.6 Aplicativos corporativos e modo quiosque
- Catálogo de apps pelo package name e Managed Google Play conforme elegibilidade, aprovação, instalação forçada quando suportada, allowlist, rollout, configuração gerenciada e atualização controlada.
- Diferenciar distribuição nativa Managed Play de upload arbitrário de APK; custom APK apenas se houver fluxo Google autorizado. Nunca afirmar que sistema pode instalar silenciosamente qualquer arquivo em qualquer Android.
- Kiosk single/multi-app para aparelhos dedicados, acesso de emergência e processo de recuperação; launcher próprio somente quando suportado e aprovado.
- Suporte futuro a apps privados, OEMConfig/Knox Service Plugin, sistemas de PDV, scanners e impressoras. Validar fabricantes/licenças/versões.

### 5.7 Comandos remotos e confiabilidade
- Operações aprovadas: lock, reboot, lost mode, limpeza controlada de dados, mudança de política, remoção/desprovisionamento, wipe quando adequado e suportado; implementar **matriz de compatibilidade real**.
- Estados mínimos: `requested`, `validated`, `waiting_approval`, `queued`, `sent_to_provider`, `provider_accepted`, `device_acknowledged`, `applied_verified`, `failed`, `expired`, `cancelled`, `unknown`. Não pressupor que cada conector conhece todas as etapas.
- Correlation ID, ator, razão, alvo, impacto, janela de execução, deadline, idempotency key, progresso e resultados individuais em lote; retry seguro, DLQ, cancelamento condicionado à plataforma, relatórios de falha.
- `wipe`, `relinquish ownership`, `clear app data`, ações de larga escala e lost mode: avisos explícitos sobre perdas irreversíveis, confirmação reforçada, RBAC e aprovação dupla quando pertinente. Em simulador só afetam dados sintéticos. Wipe desligado por padrão.
- O backend não deve “inventar” sucesso sem ack. Exibir “aguardando dispositivo”, “confirmado pelo provedor” e “aplicação verificada” distintamente.

### 5.8 Monitoramento, alertas e suporte
- Capturar somente sinais disponíveis no modo/tipo de dispositivo: conectividade, versão, atualização, bateria/armazenamento **quando houver telemetria disponível**, status do app e report de incidentes. Não inferir que AMAPI fornece todas as métricas em tempo real.
- Agente Kotlin opcional somente para métricas com API/consentimento adequados, com Android Keystore, WorkManager, permissões mínimas, autenticação, política de coleta, desativação e exclusão. Sem serviço persistente oculto e sem coleta pessoal excessiva.
- Sessão de visualização/controle remoto é projeto separado, dependente de APIs OEM, permissões e consentimento: **não simular controle remoto como real**.
- Alertas agrupados/deduplicados, incidentes com timeline, regras de severidade e triagem, exportações e integração com service desk.

### 5.9 Auditoria, relatórios e configurações
- Auditoria append-only/tamper-evident, correlacionando quem, quando, de onde, por quê, qual recurso/tenant, pedido e resultado; redigir PII/segredos e aplicar retenção controlada.
- Relatórios por filial/fabricante/política, falhas recorrentes, qualidade de enrollment, SLA de resposta e inventário; CSV e PDF apenas se realmente implementados/testados; filtros com checagem de permissão.
- Integração externa por REST/webhooks com assinatura HMAC, replay protection, tentativas, fila, contratos e documentação; tokens com escopos mínimos e rotação.

## 6. Diferenciais futuros que devem influenciar o design agora

Projetar interfaces e eventos necessários, mas NÃO tentar implementar todos antes do MVP:

1. **Self-Healing supervisionado:** detecção de incidentes comuns, hipóteses baseadas em evidências, correção por playbooks previamente aprovados e verificação posterior. Nunca limpar cache/dados ou reiniciar app se houver risco a pedidos não sincronizados.
2. **Correlação coletiva de incidentes:** detectar concentração de falhas por modelo, versão, loja, operadora, Wi-Fi e versão do app; diferenciar raiz provável de certeza.
3. **Simulador/Digital Twin de políticas:** avaliar impacto sobre inventário/capacidades e histórico, mostrar alcance, risco e limitações; simular não equivale a provar comportamento real.
4. **Zero Trust contextual:** compliance + identidade + risco, integrar autorização com IdP/ERP quando houver API suportada; restrição proporcional e meios de recuperação.
5. **Substituição de aparelho:** transferir assignment e políticas; recuperar somente dados já sincronizados/autorizados; medir tempo de restauração.
6. **Manutenção preditiva:** scoring explicável, inicialmente estatístico, com séries reais suficientes; não afirmar previsão validada sem testes históricos.
7. **Operação comercial offline:** integrações opcionais com apps/ERP para saúde de sincronização e filas, sem acessar conteúdo de pedido desnecessariamente.
8. **Copiloto de TI em linguagem natural:** só leitura no começo, consulta auditável, explicações com fontes e timestamps, sem acesso cruzado entre tenants. Nenhum prompt pode ser convertido diretamente em wipe/lock sem aprovação, checagens RBAC e fluxo humano.
9. **Medidor de impacto comercial:** ligação de incidentes a disponibilidade de lojas, PDV e aplicativos; nunca inferir faturamento perdido sem dados integrados e metodologia.
10. **Transparência de privacidade para funcionários:** apresentação clara da política e dados geridos, registros de finalidade e retenção, evitando vigilância invasiva.
11. **Playbooks visuais:** gatilho-condição-ação, dry-run, limites de execução, parada automática se taxa de falha passar limite, detecção de loops e auditoria.
12. **Integração opcional MCP oficial Android Management API (em preview):** primeiro só leitura com identidade IAM dedicada, escopos mínimos e validação explícita da maturidade atual. Nunca fazer da prévia requisito do core nem declarar acesso disponível sem elegibilidade.

## 7. Segurança: requisitos de bloqueio de release

Segurança não é uma fase opcional. Use NIST SP 800-124 Rev. 2, OWASP ASVS para aplicação web, OWASP MASVS/MASTG se houver app Android, boas práticas Zero Trust e requisitos LGPD. Realize threat modeling STRIDE por ativos, fluxos e privilégios, produza `/docs/SECURITY_THREAT_MODEL.md` e mantenha registro dos riscos abertos.

Obrigatório: autenticação forte; checagem de autorização em todos os endpoints; isolation de tenants testada; contas administrativas limitadas; logs de acesso e ações; cifragem em trânsito e em repouso; secretos fora do Git; rate limit; validação forte de entradas; proteção XSS/CSRF/SQLi/SSRF; webhook signatures e controles anti-replay; política CORS estrita; CSP quando compatível; segurança de arquivos; supply-chain scanning; dependabot/renovate; SBOM; backups criptografados e **restauração testada**, rotação de credenciais, controle de sessions e revogação, verificação de timeouts, respostas sem vazamento de stack trace e fail-closed nas permissões. Não criar backdoors, usuário master escondido, senha padrão, bypass de MFA ou permissões mágicas.

Para ações sensíveis: justificativa obrigatória, confirmação contextual e escopo explícito, eventual MFA step-up, aprovação dupla, throttling, janelas de manutenção, limitação por percentual de frota, circuito de emergência para suspender automações, monitoramento e notificação. Segregação de funções: quem solicita um wipe em massa não o aprova sozinho. Registrar tentativa negada. Na eventualidade de falha de autorização externa, rejeitar comandos e manter fila segura até nova avaliação.

**Privacidade/LGPD:** transparência, necessidade/finalidade, base legal e avaliação por responsáveis humanos, políticas de retenção e exclusão, segregação de dados pessoais/corporativos, exportações controladas e direito dos titulares quando aplicável. Localização só em modos e circunstâncias legalmente permitidos (por exemplo, lost mode em aparelho corporativo com suporte); não usar rastreamento contínuo oculto de funcionário. Nunca coletar conversas privadas, senhas, dados bancários pessoais, áudio clandestino ou conteúdo pessoal de apps.

Não alegar certificação ISO/SOC2, conformidade legal completa, auditoria externa ou pen-test concluído só com testes automatizados. Entregue checklist de preparação e necessidades de revisão independente.

## 8. Design: padrão mínimo de uma plataforma premium

Crie interface original, muito bem acabada, com identidade própria aprovada no CHECKPOINT 2; fluidez, uso eficiente de espaço, arquitetura de informação clara. Linguagem pt-BR, moeda BRL, fuso configurável, datas brasileiras, e suporte futuro a i18n sem strings espalhadas pelo código.

Páginas previstas: landing privada/onboarding, login/MFA, overview, inventário, detalhes de dispositivo, enrollment, grupos/unidades/usuários, políticas, editor de políticas e diff, apps, comandos, operações em massa, compliance, alertas, incidentes, automações, relatórios, auditoria, aprovações, integrações, configurações, ajuda e manual.

Componentes: sidebar recolhível, breadcrumbs, command palette, tabelas com filtros salvos e pesquisa, multi-select com ações seguras, painéis laterais, modais acessíveis, toasts úteis, skeletons, dark/light, estados vazios de qualidade, foco visível, navegação por teclado, contraste WCAG AA quando aplicável, responsividade e desempenho. Modais de risco devem exibir dados precisos e impacto, jamais esconder informações atrás de texto genérico.

**Modo Demonstração:** criar 100–500 dispositivos sintéticos com distribuições realistas, usuários/filiais fictícios e cenários de incidentes. Deve ser opt-in/local e ter banner persistente “DADOS SIMULADOS”; todas as ações serem realmente executadas no simulador com persistência e trilha de auditoria, não simples botões que fazem toast de sucesso. Nenhum botão pode parecer funcionar se não produz efeito verificável.

## 9. Desenvolvimento seguro incremental (ordem de execução)

Organize a execução em fatias verticais, cada uma com dados, backend, frontend, validação, testes e documentação. Sugestão:

**Fase A — Fundamentos:** repo, ADRs, checklists, formato de erros, infra local, autenticação, schema e migrations, RBAC, tenant context e testes. Ao terminar, app login funcional e health checks.

**Fase B — Inventário realista com simulador:** seeds sintéticos, listagem, detalhes, filtros, gestão de empresas/unidades e atribuição de aparelhos. Testar consultas, paginação, isolamento tenant e integridade.

**Fase C — Políticas:** versões, templates, atribuição, preview/diff, validação, regras de capacidade, reconciliação simulada e conformidade. Testar conflitos e mudanças em massa.

**Fase D — Orquestração de comandos:** filas, comandos comuns e de alto risco simulados, estados corretos, eventos, retries, falhas, filas mortas, logs, aprovações e cancelamento. Cenário de aparelho desconectado e retorno depois de vários dias.

**Fase E — UI avançada e monitoramento:** dashboard, alertas, incidentes, visualização por filial, histórico, relatórios auditáveis, melhorias UX e testes E2E.

**Fase F — Provedor real homologado:** depende do CHECKPOINT 6, documentação de elegibilidade, credenciais, permissões e hardware; implementar provider oficial com testes de contrato e **piloto não destrutivo**. Primeiro enrollment e read-only, depois políticas seguras, somente depois comandos sensíveis.

**Fase G — Automações e diferenciais:** engine eventos/regras, dry-run, aprovação, correlação e IA opcional; pilotos controlados e verificáveis.

**Fase H — Hardening/implantação:** carga, backups e restore, observabilidade, incident response, threat model, pentest externo, políticas de atualização, cota/rate-limit, canário, runbooks e readiness de produção.

Para cada fase use Definition of Done: `implementado`, `testes locais executados com saída`, `critérios de aceite cobertos`, `documentado`, `sem segredos no Git`, `UX revisada`, `limitações explicitadas`. Se o ambiente não permitir executar comandos, diga **NÃO EXECUTADO** e entregue instruções verificáveis, nunca invente resultado.

## 10. Engenheiro de qualidade: testes obrigatórios e falhas controladas

Antes de afirmar “pronto”, valide no mínimo:
- RBAC/tenant isolation (tentativas deliberadas de cross-tenant leakage e IDOR).
- Aprovador de wipe não ser o mesmo solicitante para eventos de larga escala; MFA step-up se habilitado.
- Confirmação do provedor não virar `applied_verified` sem prova.
- Duplicação de evento, entrega fora de ordem, retry, restart de worker, expiração de comando e dispositivo offline.
- Política impossível para certo modelo/Android mostrar incompatibilidade.
- Mudança de uma política não sobrescrever silenciosamente outra mais recente.
- Troca de funcionário/loja não manter permissões antigas indevidas.
- Logout e revogação efetiva de sessão; rate limiting; validação de dados maliciosos; ausência de secrets em logs.
- Eventos do Google Pub/Sub processados com autenticação/validação, idempotência e mensagens repetidas/atrasadas.
- Aplicação sem internet, banco reiniciado, Redis indisponível, provedor retornando 429, credencial expirada; UI mostrar estado desconhecido em vez de sucesso.
- Compatibilidade de temas, teclado, viewport, navegação, formulários, tabelas e acessibilidade.
- Teste de restore de backup em ambiente separado e comparação de registros críticos.
- Casos especiais FRP/eSIM e de wipe documentados quando a plataforma os suportar.

Mantenha `TEST_REPORT.md` apontando comandos executados, resultados, ambiente e falhas conhecidas. Manter métricas de qualidade (testes pertinentes, tempo, problemas) sem fazer porcentagens artificiais. Para integrações com Android real: checklist de autorização do titular, modo de propriedade, credenciais, versão, resultado visual no aparelho, confirmação no backend e evidência do teste.

## 11. Contratos e estados: proibição de dados falsos ou claims impossíveis

Toda entidade com sincronização deve ter timestamp, source (`simulator`, `android_management_api`, `vendor_connector`, `companion_app`), confidence/reliability quando relevante, status de stale e fallback `unknown`. Dispositivo sem comunicação **não é** automaticamente roubado, comprometido, desligado ou offline. Bateria 12% só pode ser real se um provedor autorizado efetivamente entregou essa leitura, com tempo da amostra. “Localização” só aparece se permissão/capacidade/justificativa/estado permitirem. “Economia de R$” só com fórmula e dados verificáveis.

As interfaces dos providers devem cobrir: `listDevices`, `getDevice`, `enroll`, `getCapabilities`, `applyPolicy`, `getCompliance`, `issueCommand`, `getCommandStatus`, `listApplications`, `configureApps`, `consumeProviderEvent`; implementar somente métodos realmente suportados. Retornar `UnsupportedCapabilityError` tipado e amigável em lugar de sucesso inventado. Nunca tratar `ack` de API como ação final executada no hardware.

## 12. Automações e IA com limites explícitos

Criar engine regras determinística antes de IA, incluindo prioridade, limites, cooldown, idempotência, detecção de loops, interruptor global de emergência, whitelist de ações, versão da regra, owner e justificativa. Mostrar ao administrador “por que essa ação seria executada” e preview do escopo.

Copiloto de IA só depois de o core estar sólido; inicialmente read-only com respostas que citam registros reais, timestamps e limitações. Usar tool-calling com schema e políticas estritas, sanitização de entrada, defesa contra prompt injection em nomes/descrições/logs/webhooks, isolamento tenant. Qualquer ferramenta destrutiva precisa de processo humano fora do LLM; o próprio modelo não pode ser o único aprovador. Não enviar PII/segredos a terceiros sem revisão, configuração e base legal. Providenciar modo sem LLM, com insights tradicionais.

Se for apropriado e autorizado, investigar o **servidor MCP oficial da Android Management API** (preview em 2026) como interface de consultas controladas; validar contrato atual e IAM mínimo antes de integrar. Ele não substitui nossa arquitetura nem a aprovação do Google.

## 13. Integrações futuras para empresas que vendem produtos

Interfaces desacopladas para ERP, CRM, sistemas de estoque e PDV, IDP, helpdesk, mapas opcionais e alertas. Não pressupor acesso aos dados comerciais de cliente sem contrato ou credencial. Permitir mapear `device_id -> branch_id -> critical_app_ids -> business_process`. Criar correlação de incidentes técnicos por filial e app e classificar o impacto **sem monitorar hábitos pessoais de funcionários**. A operação comercial offline deve depender de APIs/telemetria fornecidas pelos apps de negócio; evitar apagar app/dados com pedido pendente. Integrar com provedores após seleção explícita e análise de custo/segurança.

## 14. Experiência de entrega para desenvolvedor iniciante/intermediário

Como usuário, vou fazer muito desenvolvimento por linguagem natural (“vibe coding”). Portanto:
1. Explique o conceito de cada fase em português simples sem sacrificar técnica.
2. Quando pedir instalação de ferramentas, dê comandos adequados ao meu sistema operacional, o que esperar de saída e como resolver erros frequentes.
3. Tome iniciativa para criar arquivos, editar código, rodar testes e analisar erros quando as ferramentas estiverem acessíveis. **Não dependa de eu copiar 30 arquivos manualmente** se estiver no Claude Code.
4. Faça commits Git pequenos e descritivos, somente se houver repositório configurado e permissão; não faça push nem publique sem aprovação.
5. Ao concluir uma fatia, informe: o que funciona, onde acessar localmente, comandos para rodar, testes executados, problemas e próximo checkpoint.
6. Evite transcrever arquivos enormes toda hora; explique mudanças e caminhos. Se estiver apenas no chat sem acesso ao filesystem, forneça estrutura de projeto e arquivos em lotes completos, sem fingir que o software foi compilado ou está hospedado.
7. Se for interrompido por limite de contexto, continue do `docs/PROJECT_STATUS.md`, `docs/PRODUCT_DECISIONS.md`, `docs/ROADMAP.md`, `docs/OPEN_QUESTIONS.md`, `docs/adr/` e `CLAUDE.md`. Atualize esses documentos ao fim de cada etapa.
8. Não prometa trabalho em background, testes que não executou, hardware que não controlou ou serviços que não conectou.
9. Não peça chaves privadas/senhas em texto de chat: use `.env.local`, secret manager, variável de ambiente e instruções seguras para eu preencher.
10. Não tente fazer toda a aplicação em uma resposta; prefira ciclos curtos e aprovados.

## 15. Estrutura sugerida de repositório

```text
project-root/
  CLAUDE.md
  README.md
  .env.example
  docker-compose.yml
  pnpm-workspace.yaml
  apps/
    web/                 # interface administrativa
    api/                 # core REST / NestJS
    worker/              # filas, reconciliação e eventos
    android-companion/   # OPCIONAL: Kotlin; somente se autorizado/necessário
  packages/
    ui/
    types/
    validation/
    provider-contracts/
    policy-schema/
    config/
  infrastructure/
    local/
    scripts/
  docs/
    PRODUCT_DECISIONS.md
    OPEN_QUESTIONS.md
    PROJECT_STATUS.md
    ROADMAP.md
    ANDROID_FEASIBILITY.md
    ANDROID_CAPABILITIES.md
    SECURITY_THREAT_MODEL.md
    TEST_REPORT.md
    RUNBOOKS.md
    adr/
  tests/
    e2e/
    integration/
```

Ajuste a estrutura para evitar boilerplate excessivo. Não crie diretórios vazios apenas para enfeitar: cada módulo deve possuir uso concreto.

## 16. Documentação oficial e referências (revalidar em tempo de implementação)

Documentação com prioridade sobre blogs e tutoriais:
- Uso permitido da Android Management API: https://developers.google.com/android/management/permissible-usage
- Introdução AMAPI: https://developers.google.com/android/management/introduction
- Guia rápido: https://developers.google.com/android/management/quickstart
- Enrollment/QR: https://developers.google.com/android/management/provision-device
- API REST, políticas: https://developers.google.com/android/management/reference/rest/v1/enterprises.policies
- Comandos: https://developers.google.com/android/management/reference/rest/v1/enterprises.devices/issueCommand
- Eventos Pub/Sub: https://developers.google.com/android/management/notifications
- Compliance: https://developers.google.com/android/management/compliance
- Lost Mode: https://developers.google.com/android/management/lost-mode
- Managed Apps: https://developers.google.com/android/management/apps
- Roles de apps: https://developers.google.com/android/management/app-roles
- Release notes: https://developers.google.com/android/management/release-notes
- Guia de lançamento/validação: https://developers.google.com/android/work/release-solution
- Fim dos novos registros de DPC pela antiga EMM API: https://developers.google.com/android/work/play/emm-api/register
- Guia DPC/DevicePolicyManager: https://developer.android.com/work/dpc/build-dpc
- Dedicated device/kiosk: https://developer.android.com/work/dpc/dedicated-devices
- Testes e provisionamento: https://developer.android.com/work/guide
- MCP AMAPI em prévia: https://developers.google.com/android/management/use-android-management-mcp
- Microsoft Intune Android compliance: https://learn.microsoft.com/en-us/intune/device-security/compliance/ref-android-enterprise-settings
- Samsung Knox/OEMConfig: https://docs.samsungknox.com/admin/knox-platform-for-enterprise/knox-service-plugin/references/stig-9/
- NIST mobile enterprise: https://csrc.nist.gov/pubs/sp/800/124/r2/final
- OWASP MASVS: https://mas.owasp.org/MASVS/

Trate docs oficiais e documentação atualizada como fonte de verdade. Se uma referência estiver indisponível ou modificada, informe o impedimento. Não invente endpoints, payloads, SDKs, permissões ou versões.

## 17. Gate de produção e limitações inegociáveis

O objetivo é software seguro, legal, confiável e vendável futuramente, não uma ferramenta de espionagem. Não desenvolver exfiltração oculta, bypass de administração, vigilância secreta, persistência maliciosa, controle de aparelhos não autorizados ou ações ocultas em dispositivos pessoais. O fato de ser “corporativo” não elimina a necessidade de propriedade, autoridade, transparência e controles proporcionais. Nenhuma versão deve ser rotulada “pronta para produção” sem testes de segurança, backup/restauração, revisão de privacidade, homologação e integração real aprovada.

Qualquer funcionalidade bloqueada por restrições do Google deve ser classificada como: `Disponível oficialmente`, `Depende de elegibilidade/credenciais`, `Depende do fabricante/versão`, `Somente com app corporativo cooperante`, `Somente em laboratório`, `Não suportada`, ou `A pesquisar`. A UI deve refletir isso e nunca criar uma falsa sensação de controle.

## 18. O QUE VOCÊ DEVE FAZER NA SUA PRIMEIRA RESPOSTA

**Não escreva código ainda. Não escolha o nome da marca nem o design sozinho.** Faça exatamente estas cinco coisas:

1. Confirme em até 8 linhas que compreendeu a missão, a exclusividade Android, o foco em empresas comerciais, as exigências de segurança e a construção em etapas com perguntas obrigatórias.
2. Explique brevemente as três rotas técnicas possíveis — AMAPI comercial (elegibilidade necessária), integração com MDM de terceiros para uso interno, DPC/laboratório limitado — e qual costuma ser preferível por cenário, sem afirmar que temos aprovação.
3. Apresente uma recomendação inicial de arquitetura técnica e MVP em até 10 linhas, como hipótese a validar.
4. Abra **CHECKPOINT 0 — Viabilidade, intenção e ambiente** com as 7 perguntas objetivas definidas acima, oferecendo opções fáceis de responder e sua recomendação; se for essencial, divida-o em duas rodadas curtas.
5. **Aguarde minhas respostas**. Depois delas, faça o primeiro documento de decisões e um plano executável por fatias pequenas. Siga os checkpoints ao longo de todo o desenvolvimento sem deixar de fazer perguntas criativas sobre nome, logo, cores e formato da interface.

**A partir daqui, trate minha resposta seguinte como o início efetivo da construção do projeto.**
