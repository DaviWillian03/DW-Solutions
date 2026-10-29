# Perguntas em Aberto

Formato acordado (P-001): perguntas de múltipla escolha, com recomendação marcada.

## CHECKPOINT 0 — ✅ respondido em 2026-10-23 (ver `PRODUCT_DECISIONS.md`)

## CHECKPOINT 1 — ✅ respondido em 2026-10-23 (nome “DW Solutions”, acessível, português)

## CHECKPOINT 2 — ✅ respondido em 2026-10-23 (branco + azuis, D2 Azul Gelo, M2, menu no topo)

## CHECKPOINT 3 — ✅ respondido em 2026-10-23 (ADRs 0002–0006)

## CHECKPOINT 4 — ✅ respondido em 2026-10-23 (MVP enxuto: smartphones de vendas e merchandising)

## CHECKPOINT 5 — ✅ respondido em 2026-10-23 (telas aprovadas; ilustrações junto com a Fase C)

## CHECKPOINT 6 — ✅ decidido em 2026-10-25 (ver CP6-0…8)
- CP6-4 e a cota da AMAPI deixaram de bloquear: a rota real passou a ser o Intune (B-4), que serve para uso interno.
- Aparelho Samsung/Motorola 12+ resetável existe, guardado (CP6-6).

## Rota Intune — ✅ decidida em 2026-10-25 (B-4, I-1…I-9). Pendências que bloqueiam o aparelho real:
- **I-3 / R-3:** qual é o plano Microsoft 365 da empresa? Só Business Premium e E3/E5 incluem o Intune; Basic e
  Standard não. **Comprar licença está fora de cogitação (R-1).** Se for Basic/Standard, a alternativa é o
  ManageEngine MDM Plus grátis (até 25 aparelhos, R-2), mas antes é preciso confirmar se o plano grátis dá acesso à
  API. Fontes: documentação e suporte do ManageEngine.
- **I-4:** a TI da empresa cria o aplicativo no Entra com as permissões do ADR-0010 e os 2 grupos de aparelhos
  (I-7). O passo a passo será escrito antes do laboratório.
- Laboratório (CP6-6): aparelho Samsung/Motorola 12+ guardado; só depois de I-3 e I-4.

## Próximo passo
- ✅ Fatia I2 (Localizar + Tocar som).
- Fatia **I3**: sincronização com o Intune no worker (inventário, estado das ações, perfil por versão, grupos) e o
  modo real na tela, tudo desligado e testado sem rede.

## Checkpoints futuros

## Pendências que não bloqueiam agora
- ✅ 2026-10-29: body-parser 2.4.0 e multer 2.5.0 aplicados e exceção de `auditConfig` removida (TEST_REPORT).
- Região de hospedagem dos dados (CP3-4) — CHECKPOINT 8.
- Processo de verificação de identidade para recuperar acesso do admin de uma empresa (ADR-0005) — CHECKPOINT 8.
- Aparelho Android resetável para laboratório — necessário só no CHECKPOINT 6.
- Busca formal da marca “DW Solutions” no INPI (classes 9 e 42) — antes de uso comercial.
- Domínio: `dwsolutions.com.br`/`.com` ocupados — decidir no CHECKPOINT 8.
- Enquadramento comercial (empresa/CNPJ, cliente) — só seria necessário para a AMAPI, que deixou de ser a rota (B-4).
