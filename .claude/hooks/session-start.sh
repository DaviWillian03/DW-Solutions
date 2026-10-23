#!/bin/bash
# Prepara o ambiente a cada sessão do Claude Code na nuvem: PostgreSQL, Redis, .env.local e dependências.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
bash infrastructure/local/setup.sh
