-- Aparelhos, tokens de cadastro, linha do tempo e estado do simulador (Fase B).
-- Mesmo padrão das demais tabelas de empresa: RLS forçado por tenant_id, sem DELETE (exclusão segura).

CREATE TRIGGER devices_updated_at BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE devices FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY devices_tenant ON devices FOR ALL TO dw_app
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON devices TO dw_app;--> statement-breakpoint

ALTER TABLE enrollment_tokens ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE enrollment_tokens FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY enrollment_tokens_tenant ON enrollment_tokens FOR ALL TO dw_app
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());--> statement-breakpoint
GRANT SELECT, INSERT ON enrollment_tokens TO dw_app;--> statement-breakpoint
GRANT UPDATE (used_at, device_id) ON enrollment_tokens TO dw_app;--> statement-breakpoint

-- Linha do tempo: somente inserção (correções viram novos eventos).
ALTER TABLE device_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE device_events FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY device_events_tenant ON device_events FOR ALL TO dw_app
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());--> statement-breakpoint
GRANT SELECT, INSERT ON device_events TO dw_app;--> statement-breakpoint
CREATE FUNCTION device_events_append_only() RETURNS trigger
  LANGUAGE plpgsql
  AS $$ BEGIN RAISE EXCEPTION 'device_events é somente inserção (% bloqueado)', TG_OP USING ERRCODE = '42501'; END $$;--> statement-breakpoint
CREATE TRIGGER device_events_no_update_delete BEFORE UPDATE OR DELETE ON device_events
  FOR EACH ROW EXECUTE FUNCTION device_events_append_only();--> statement-breakpoint

-- Estado interno do simulador (só usado pelo SimulatorProvider; nunca exibido como dado real).
ALTER TABLE sim_devices ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sim_devices FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY sim_devices_tenant ON sim_devices FOR ALL TO dw_app
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON sim_devices TO dw_app;
