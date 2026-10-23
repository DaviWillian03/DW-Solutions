# ADR-0006 — Ambiente sem Docker, CI gratuita e cadeia de suprimentos

- **Status:** Aceito · **Data:** 2026-10-23 · **Decisões:** CP0-5, CP0-6, CP3-4

## Decisão
- **Ambiente de desenvolvimento = container do Claude Code na nuvem.** Script `infrastructure/local/setup.sh`
  (acionado por gancho de início de sessão) inicia PostgreSQL 16 e Redis 7 nativos, cria bancos `dw_dev` e
  `dw_test`, papéis `dw_app`/`dw_migrator`/`dw_platform` e instala dependências. Idempotente.
- `docker-compose.yml` será mantido para quem rodar fora do container, mas não é requisito.
- **CI GitHub Actions:** lint, typecheck, testes com PostgreSQL/Redis como serviços, `pnpm audit`, gitleaks,
  SBOM CycloneDX, Dependabot. CodeQL somente se disponível sem custo para o repositório.
- **Cadeia de suprimentos:** versões exatas, lockfile commitado, pnpm `minimumReleaseAge` de 7 dias,
  nenhum segredo no Git (`.env.example` só com nomes).
- **Região de hospedagem:** decidida no CHECKPOINT 8 (escolha do usuário em CP3-4). Até lá, nada exposto à internet.

## Consequências
- Cada sessão nova leva alguns minutos para preparar o ambiente; dados de dev são descartáveis (seeds recriam).
- Resultados de testes sempre registrados com comando e saída em `docs/TEST_REPORT.md`.
