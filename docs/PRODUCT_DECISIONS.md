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
