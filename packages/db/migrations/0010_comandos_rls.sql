-- Comandos: RLS forçado por tenant_id; o que foi pedido (tipo, alvo, parâmetros, quem pediu) não muda;
-- histórico de estados somente inserção; estado final nunca volta; decisão de aprovação é única.

CREATE TRIGGER device_commands_updated_at BEFORE UPDATE ON device_commands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

ALTER TABLE device_commands ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE device_commands FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY device_commands_tenant ON device_commands FOR ALL TO dw_app
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());--> statement-breakpoint
GRANT SELECT, INSERT ON device_commands TO dw_app;--> statement-breakpoint
GRANT UPDATE (state, state_detail, provider_ref, send_attempts, finished_at, updated_at) ON device_commands TO dw_app;--> statement-breakpoint

CREATE FUNCTION device_commands_final_state() RETURNS trigger
  LANGUAGE plpgsql
  AS $$ BEGIN
    IF OLD.state IN ('applied_verified', 'failed', 'expired', 'cancelled') AND NEW.state IS DISTINCT FROM OLD.state THEN
      RAISE EXCEPTION 'comando em estado final (%) não muda de estado', OLD.state USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END $$;--> statement-breakpoint
CREATE TRIGGER device_commands_final_state BEFORE UPDATE ON device_commands
  FOR EACH ROW EXECUTE FUNCTION device_commands_final_state();--> statement-breakpoint

ALTER TABLE command_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE command_events FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY command_events_tenant ON command_events FOR ALL TO dw_app
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());--> statement-breakpoint
GRANT SELECT, INSERT ON command_events TO dw_app;--> statement-breakpoint
CREATE FUNCTION command_events_append_only() RETURNS trigger
  LANGUAGE plpgsql
  AS $$ BEGIN RAISE EXCEPTION 'command_events é somente inserção (% bloqueado)', TG_OP USING ERRCODE = '42501'; END $$;--> statement-breakpoint
CREATE TRIGGER command_events_no_update_delete BEFORE UPDATE OR DELETE ON command_events
  FOR EACH ROW EXECUTE FUNCTION command_events_append_only();--> statement-breakpoint

ALTER TABLE command_batches ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE command_batches FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY command_batches_tenant ON command_batches FOR ALL TO dw_app
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());--> statement-breakpoint
GRANT SELECT, INSERT ON command_batches TO dw_app;--> statement-breakpoint
GRANT UPDATE (status, decided_by, decided_by_name, decided_at, decision_note) ON command_batches TO dw_app;--> statement-breakpoint

CREATE FUNCTION command_batches_single_decision() RETURNS trigger
  LANGUAGE plpgsql
  AS $$ BEGIN
    IF OLD.status <> 'waiting_approval' AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'lote já decidido (%)', OLD.status USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END $$;--> statement-breakpoint
CREATE TRIGGER command_batches_single_decision BEFORE UPDATE ON command_batches
  FOR EACH ROW EXECUTE FUNCTION command_batches_single_decision();--> statement-breakpoint

CREATE TRIGGER tenant_settings_updated_at BEFORE UPDATE ON tenant_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE tenant_settings FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_settings_tenant ON tenant_settings FOR ALL TO dw_app
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());--> statement-breakpoint
GRANT SELECT, INSERT ON tenant_settings TO dw_app;--> statement-breakpoint
GRANT UPDATE (wipe_enabled, updated_by, updated_at) ON tenant_settings TO dw_app;
