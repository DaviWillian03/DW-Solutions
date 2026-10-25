# Roadmap (provisório — será revisado após CHECKPOINTS 0, 3 e 4)

| Etapa | Conteúdo | Depende de | Status |
|-------|----------|------------|--------|
| CP0 | Viabilidade, intenção e ambiente | Usuário | ✅ concluído |
| CP1 | Nome e posicionamento | CP0 | ✅ concluído (DW Solutions) |
| CP2 | Direção visual, logo, protótipos | CP1 | ✅ concluído (design system v1) |
| CP3 | Arquitetura e implantação (ADRs) | CP0 | ✅ concluído (ADRs 0002–0006) |
| CP4 | Escopo do MVP (MoSCoW) | CP3 | ✅ concluído (MVP enxuto) |
| Fase A | Fundamentos: monorepo, setup do container, banco + RLS, login + MFA, perfis | CP4 | ✅ concluída |
| Fase B | Simulador, cadastro QR demo, aparelhos | Fase A | ✅ concluída |
| CP5 | Revisão das primeiras telas reais | Fase B | ✅ concluído (telas aprovadas) |
| Fase C | Políticas Vendas/Merchandising e conformidade | Fase B | ✅ concluída (ADR-0007) |
| Fase D | 5 comandos com estados verificáveis e regra do wipe | Fase C | ✅ concluída (ADR-0008) |
| Fase E | MVP: tela de Auditoria (M11). Alertas, incidentes e relatórios ficaram fora do MVP (CP4) | Fase D | ✅ concluída |
| CP6 / Fase F | Provedor Android real homologado | Elegibilidade + hardware | 🟡 CP6 decidido; conector pronto e desligado (ADR-0009); ligar depende de CP6-4 + cota |
| Rota B | Estudo de MDM de terceiros (uso interno) | CP6-3 | ✅ estudo feito; Intune candidato; pausado (B-3) |
| CP7 / Fase G | Automações e IA supervisionada | Fase E | ⚪ |
| CP8 / Fase H | Hardening, piloto e publicação | Tudo acima | ⚪ |

Observação: CP1/CP2 (marca e visual) podem correr em paralelo com CP3/Fase A, pois o design
system só é cristalizado após aprovação.
