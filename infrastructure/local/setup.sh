#!/usr/bin/env bash
# Prepara o ambiente de desenvolvimento DW Solutions no container (ADR-0006).
# - Inicia PostgreSQL 16 e Redis 7 nativos, ouvindo só em 127.0.0.1.
# - Cria papéis dw_migrator / dw_app / dw_platform e bancos dw_dev / dw_test.
# - Gera .env.local com senhas aleatórias (nunca commitado) e reaproveita as existentes.
# - Instala dependências com pnpm.
# Idempotente: pode rodar quantas vezes quiser.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT/.env.local"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PG_DATA="${PG_DATA:-/var/lib/postgresql/dw-16}"
PG_LOG="/var/lib/postgresql/dw-16.log"
PG_PORT=5432
REDIS_PORT=6379

log() { echo "[setup] $*"; }
as_pg() { runuser -u postgres -- "$@"; }

# ---------- senhas (geradas uma vez, guardadas em .env.local) ----------
get_env() { [ -f "$ENV_FILE" ] && grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true; }
pw_from_url() { sed -E 's#^[a-z]+://[^:]+:([^@]+)@.*#\1#' <<<"$1"; }
random_pw() { openssl rand -hex 24; }

APP_PW="$(pw_from_url "$(get_env DATABASE_URL)")"
MIG_PW="$(pw_from_url "$(get_env MIGRATOR_DATABASE_URL)")"
PLAT_PW="$(pw_from_url "$(get_env PLATFORM_DATABASE_URL)")"
AUTH_PW="$(pw_from_url "$(get_env AUTH_DATABASE_URL)")"
AUTH_SECRET="$(get_env BETTER_AUTH_SECRET)"
[[ "$APP_PW" =~ ^[0-9a-f]{48}$ ]] || APP_PW="$(random_pw)"
[[ "$MIG_PW" =~ ^[0-9a-f]{48}$ ]] || MIG_PW="$(random_pw)"
[[ "$PLAT_PW" =~ ^[0-9a-f]{48}$ ]] || PLAT_PW="$(random_pw)"
[[ "$AUTH_PW" =~ ^[0-9a-f]{48}$ ]] || AUTH_PW="$(random_pw)"
[[ "$AUTH_SECRET" =~ ^[0-9a-f]{64}$ ]] || AUTH_SECRET="$(openssl rand -hex 32)"

# ---------- PostgreSQL ----------
if [ ! -f "$PG_DATA/PG_VERSION" ]; then
  log "inicializando cluster PostgreSQL em $PG_DATA"
  install -d -o postgres -g postgres -m 700 "$PG_DATA"
  as_pg "$PG_BIN/initdb" -D "$PG_DATA" --auth-local=peer --auth-host=scram-sha-256 -E UTF8 --locale=C.UTF-8 >/dev/null
  cat >>"$PG_DATA/postgresql.conf" <<CONF
listen_addresses = '127.0.0.1'
port = $PG_PORT
unix_socket_directories = '/var/run/postgresql'
password_encryption = 'scram-sha-256'
CONF
fi

if ! as_pg "$PG_BIN/pg_ctl" -D "$PG_DATA" status >/dev/null 2>&1; then
  log "iniciando PostgreSQL"
  install -d -o postgres -g postgres -m 2775 /var/run/postgresql
  as_pg "$PG_BIN/pg_ctl" -D "$PG_DATA" -l "$PG_LOG" -w start >/dev/null
fi

psql_su() { as_pg psql -v ON_ERROR_STOP=1 -q -X -d "${1:-postgres}" ; }

log "configurando papéis e bancos"
psql_su postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dw_migrator') THEN CREATE ROLE dw_migrator LOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dw_app') THEN CREATE ROLE dw_app LOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dw_platform') THEN CREATE ROLE dw_platform LOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dw_auth') THEN CREATE ROLE dw_auth LOGIN; END IF;
END \$\$;
-- Nenhum papel da aplicação ignora RLS nem é superusuário (ADR-0004).
ALTER ROLE dw_migrator NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD '$MIG_PW';
ALTER ROLE dw_app      NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD '$APP_PW';
ALTER ROLE dw_platform NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD '$PLAT_PW';
ALTER ROLE dw_auth     NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD '$AUTH_PW';
SQL

for DB in dw_dev dw_test; do
  if ! as_pg psql -tAX -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$DB'" | grep -q 1; then
    as_pg createdb -O dw_migrator "$DB"
  fi
  psql_su "$DB" <<SQL
REVOKE ALL ON DATABASE $DB FROM PUBLIC;
GRANT CONNECT ON DATABASE $DB TO dw_migrator, dw_app, dw_platform, dw_auth;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO dw_migrator;
GRANT USAGE ON SCHEMA public TO dw_app, dw_platform, dw_auth;
SQL
done

# ---------- Redis ----------
if ! redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; then
  log "iniciando Redis"
  redis-server --daemonize yes --bind 127.0.0.1 --port "$REDIS_PORT" --save "" --appendonly no \
    --logfile /var/log/dw-redis.log >/dev/null
  for _ in $(seq 1 20); do redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1 && break; sleep 0.2; done
fi

# ---------- .env.local ----------
url() { echo "postgres://$1:$2@127.0.0.1:$PG_PORT/$3"; }
umask 077
cat >"$ENV_FILE" <<ENV
# Gerado por infrastructure/local/setup.sh — NÃO commitar. Senhas aleatórias de desenvolvimento.
NODE_ENV=development
API_PORT=3001
LOG_LEVEL=info
DATABASE_URL=$(url dw_app "$APP_PW" dw_dev)
MIGRATOR_DATABASE_URL=$(url dw_migrator "$MIG_PW" dw_dev)
PLATFORM_DATABASE_URL=$(url dw_platform "$PLAT_PW" dw_dev)
AUTH_DATABASE_URL=$(url dw_auth "$AUTH_PW" dw_dev)
TEST_DATABASE_URL=$(url dw_app "$APP_PW" dw_test)
TEST_MIGRATOR_DATABASE_URL=$(url dw_migrator "$MIG_PW" dw_test)
TEST_PLATFORM_DATABASE_URL=$(url dw_platform "$PLAT_PW" dw_test)
TEST_AUTH_DATABASE_URL=$(url dw_auth "$AUTH_PW" dw_test)
REDIS_URL=redis://127.0.0.1:$REDIS_PORT
WEB_ORIGIN=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=$AUTH_SECRET
ENV
umask 022

# ---------- dependências ----------
if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  log "instalando dependências (pnpm install)"
  (cd "$ROOT" && pnpm install --prefer-offline >/dev/null)
fi

log "pronto: PostgreSQL em 127.0.0.1:$PG_PORT, Redis em 127.0.0.1:$REDIS_PORT, variáveis em .env.local"
