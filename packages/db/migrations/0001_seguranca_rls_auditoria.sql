-- Segurança do banco (ADR-0004 e ADR-0005)
-- * RLS forçado por empresa em todas as tabelas de dados.
-- * dw_app: só a própria empresa (via app.tenant_id). dw_platform: só a tabela de empresas e
--   inserção de eventos de auditoria de plataforma; nunca lê dados de clientes.
-- * Auditoria append-only com cadeia de hash por empresa.

-- Esquema acessível aos papéis da aplicação (idempotente com o script de setup).
GRANT USAGE ON SCHEMA public TO dw_app, dw_platform;--> statement-breakpoint

-- Empresa da transação atual. Sem configuração => NULL => nenhuma linha (fail-closed).
CREATE FUNCTION app_current_tenant() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;--> statement-breakpoint

-- updated_at automático
CREATE FUNCTION set_updated_at() RETURNS trigger
  LANGUAGE plpgsql
  AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;--> statement-breakpoint
CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER device_holders_updated_at BEFORE UPDATE ON device_holders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenants_app_select ON tenants FOR SELECT TO dw_app
  USING (id = app_current_tenant());--> statement-breakpoint
CREATE POLICY tenants_platform_all ON tenants FOR ALL TO dw_platform
  USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT ON tenants TO dw_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON tenants TO dw_platform;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- device_holders (sem DELETE: exclusão segura por status)
-- ---------------------------------------------------------------------------
ALTER TABLE device_holders ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE device_holders FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY device_holders_tenant ON device_holders FOR ALL TO dw_app
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON device_holders TO dw_app;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------------------
-- Ponta da cadeia por empresa. Sem RLS e sem permissões para os papéis da aplicação:
-- só as funções SECURITY DEFINER abaixo acessam. O bloqueio da linha serializa inserções concorrentes.
CREATE TABLE audit_chain_heads (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE RESTRICT,
  last_seq bigint NOT NULL,
  last_hash text NOT NULL
);--> statement-breakpoint
REVOKE ALL ON audit_chain_heads FROM PUBLIC;--> statement-breakpoint

-- Forma canônica do evento: array JSON (sem ambiguidade de separadores ou nulos).
CREATE FUNCTION audit_event_hash(e audit_events) RETURNS text
  LANGUAGE sql IMMUTABLE
  AS $$
    SELECT encode(sha256(convert_to(jsonb_build_array(
      e.prev_hash, e.id, e.tenant_id, e.seq,
      to_char(e.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      e.actor_type, e.actor_id, e.action, e.target_type, e.target_id, e.outcome,
      e.reason, e.metadata, e.request_id, host(e.source_ip)
    )::text, 'UTF8')), 'hex')
  $$;--> statement-breakpoint

CREATE FUNCTION audit_events_chain() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
  DECLARE
    head audit_chain_heads%ROWTYPE;
  BEGIN
    INSERT INTO audit_chain_heads (tenant_id, last_seq, last_hash)
      VALUES (NEW.tenant_id, 0, repeat('0', 64))
      ON CONFLICT (tenant_id) DO NOTHING;
    SELECT * INTO head FROM audit_chain_heads WHERE tenant_id = NEW.tenant_id FOR UPDATE;

    -- Valores controlados pelo banco, nunca pelo cliente.
    NEW.seq := head.last_seq + 1;
    NEW.prev_hash := head.last_hash;
    NEW.occurred_at := clock_timestamp();
    NEW.hash := audit_event_hash(NEW);

    UPDATE audit_chain_heads SET last_seq = NEW.seq, last_hash = NEW.hash WHERE tenant_id = NEW.tenant_id;
    RETURN NEW;
  END
  $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION audit_events_chain() FROM PUBLIC;--> statement-breakpoint
CREATE TRIGGER audit_events_chain BEFORE INSERT ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_chain();--> statement-breakpoint

CREATE FUNCTION audit_events_append_only() RETURNS trigger
  LANGUAGE plpgsql
  AS $$ BEGIN RAISE EXCEPTION 'audit_events é append-only (% bloqueado)', TG_OP USING ERRCODE = '42501'; END $$;--> statement-breakpoint
CREATE TRIGGER audit_events_no_update_delete BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();--> statement-breakpoint
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_append_only();--> statement-breakpoint

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY audit_events_app_select ON audit_events FOR SELECT TO dw_app
  USING (tenant_id = app_current_tenant());--> statement-breakpoint
CREATE POLICY audit_events_app_insert ON audit_events FOR INSERT TO dw_app
  WITH CHECK (tenant_id = app_current_tenant() AND actor_type <> 'platform');--> statement-breakpoint
-- Plataforma registra suas ações na auditoria da empresa afetada, mas não consegue lê-la.
CREATE POLICY audit_events_platform_insert ON audit_events FOR INSERT TO dw_platform
  WITH CHECK (actor_type = 'platform');--> statement-breakpoint
GRANT SELECT, INSERT ON audit_events TO dw_app;--> statement-breakpoint
GRANT INSERT ON audit_events TO dw_platform;--> statement-breakpoint

-- Ponta da cadeia da empresa atual (única leitura permitida de audit_chain_heads).
CREATE FUNCTION audit_chain_head() RETURNS TABLE (last_seq bigint, last_hash text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT h.last_seq, h.last_hash FROM audit_chain_heads h WHERE h.tenant_id = app_current_tenant() $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION audit_chain_head() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION audit_chain_head() TO dw_app;--> statement-breakpoint

-- Verificação da cadeia da empresa atual. Retorna os problemas encontrados (vazio = íntegra).
-- Roda com as permissões de quem chama: o RLS limita a leitura à empresa da transação.
CREATE FUNCTION audit_verify_chain() RETURNS TABLE (seq bigint, problem text)
  LANGUAGE plpgsql STABLE SET search_path = public, pg_temp
  AS $$
  DECLARE
    t uuid := app_current_tenant();
    e audit_events%ROWTYPE;
    expected_seq bigint := 1;
    expected_prev text := repeat('0', 64);
    head record;
  BEGIN
    IF t IS NULL THEN
      RAISE EXCEPTION 'empresa não definida na transação' USING ERRCODE = '42501';
    END IF;
    FOR e IN SELECT * FROM audit_events a WHERE a.tenant_id = t ORDER BY a.seq LOOP
      IF e.seq <> expected_seq THEN
        seq := e.seq; problem := format('sequência esperada %s', expected_seq); RETURN NEXT;
      END IF;
      IF e.prev_hash <> expected_prev THEN
        seq := e.seq; problem := 'prev_hash não corresponde ao evento anterior'; RETURN NEXT;
      END IF;
      IF e.hash <> audit_event_hash(e) THEN
        seq := e.seq; problem := 'conteúdo alterado (hash inválido)'; RETURN NEXT;
      END IF;
      expected_seq := e.seq + 1;
      expected_prev := e.hash;
    END LOOP;
    SELECT * INTO head FROM audit_chain_head();
    IF FOUND AND (head.last_seq <> expected_seq - 1 OR head.last_hash <> expected_prev) THEN
      seq := head.last_seq; problem := 'eventos finais removidos (ponta da cadeia divergente)'; RETURN NEXT;
    END IF;
  END
  $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION audit_verify_chain() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION audit_verify_chain() TO dw_app;
