-- Políticas: RLS forçado por tenant_id. Versões são somente inserção (histórico imutável); da tabela
-- de políticas só se altera a versão atual (nome e modelo fixos no MVP).

CREATE TRIGGER policies_updated_at BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE policies FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY policies_tenant ON policies FOR ALL TO dw_app
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());--> statement-breakpoint
GRANT SELECT, INSERT ON policies TO dw_app;--> statement-breakpoint
GRANT UPDATE (current_version, updated_at) ON policies TO dw_app;--> statement-breakpoint

ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE policy_versions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY policy_versions_tenant ON policy_versions FOR ALL TO dw_app
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());--> statement-breakpoint
GRANT SELECT, INSERT ON policy_versions TO dw_app;--> statement-breakpoint
CREATE FUNCTION policy_versions_append_only() RETURNS trigger
  LANGUAGE plpgsql
  AS $$ BEGIN RAISE EXCEPTION 'policy_versions é somente inserção (% bloqueado)', TG_OP USING ERRCODE = '42501'; END $$;--> statement-breakpoint
CREATE TRIGGER policy_versions_no_update_delete BEFORE UPDATE OR DELETE ON policy_versions
  FOR EACH ROW EXECUTE FUNCTION policy_versions_append_only();--> statement-breakpoint

-- A versão atual nunca volta nem pula: só avança de 1 em 1 (o histórico não tem buracos).
CREATE FUNCTION policies_version_forward() RETURNS trigger
  LANGUAGE plpgsql
  AS $$ BEGIN
    IF NEW.current_version <> OLD.current_version + 1 AND NEW.current_version <> OLD.current_version THEN
      RAISE EXCEPTION 'versão da política só avança de 1 em 1 (% → %)', OLD.current_version, NEW.current_version
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END $$;--> statement-breakpoint
CREATE TRIGGER policies_version_forward BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION policies_version_forward();
