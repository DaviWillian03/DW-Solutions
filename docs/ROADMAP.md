# Roadmap (provisório — será revisado após CHECKPOINTS 0, 3 e 4)

| Etapa | Conteúdo | Depende de | Status |
|-------|----------|------------|--------|
| CP0 | Viabilidade, intenção e ambiente | Usuário | 🟡 em andamento |
| CP1 | Nome e posicionamento | CP0 | ⚪ |
| CP2 | Direção visual, logo, protótipos | CP1 | ⚪ |
| CP3 | Arquitetura e implantação (ADRs) | CP0 | ⚪ |
| CP4 | Escopo do MVP (MoSCoW) | CP3 | ⚪ |
| Fase A | Fundamentos: monorepo, Docker, auth, schema, RBAC, tenant | CP3 | ⚪ |
| Fase B | Inventário com simulador | Fase A | ⚪ |
| CP5 | Revisão das primeiras telas reais | Fase B | ⚪ |
| Fase C | Políticas versionadas e conformidade | Fase B | ⚪ |
| Fase D | Orquestração de comandos (filas, estados, aprovações) | Fase C | ⚪ |
| Fase E | Dashboard, alertas, incidentes, relatórios | Fase D | ⚪ |
| CP6 / Fase F | Provedor Android real homologado | Elegibilidade + hardware | ⚪ |
| CP7 / Fase G | Automações e IA supervisionada | Fase E | ⚪ |
| CP8 / Fase H | Hardening, piloto e publicação | Tudo acima | ⚪ |

Observação: CP1/CP2 (marca e visual) podem correr em paralelo com CP3/Fase A, pois o design
system só é cristalizado após aprovação.
