-- Identidade e convites (ADR-0003, ADR-0004, ADR-0005)
-- dw_auth  = papel usado pelo Better Auth: lê identidades para login, gerencia sessões/MFA/passkeys,
--            mas NÃO cria usuários e NÃO altera empresa, perfil ou situação (sem escalada de privilégio).
-- dw_app   = usuários da própria empresa (RLS); convida e desativa.
-- dw_platform = só cria o primeiro administrador de uma empresa (e o convite dele).

GRANT USAGE ON SCHEMA public TO dw_auth;--> statement-breakpoint

CREATE TRIGGER auth_users_updated_at BEFORE UPDATE ON auth_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER auth_sessions_updated_at BEFORE UPDATE ON auth_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER auth_accounts_updated_at BEFORE UPDATE ON auth_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER auth_verifications_updated_at BEFORE UPDATE ON auth_verifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- auth_users
-- ---------------------------------------------------------------------------
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE auth_users FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY auth_users_auth ON auth_users FOR ALL TO dw_auth USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY auth_users_app ON auth_users FOR ALL TO dw_app
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());--> statement-breakpoint
CREATE POLICY auth_users_platform ON auth_users FOR INSERT TO dw_platform
  WITH CHECK (role = 'admin');--> statement-breakpoint
GRANT SELECT ON auth_users TO dw_auth;--> statement-breakpoint
GRANT UPDATE (name, image, email_verified, two_factor_enabled, updated_at) ON auth_users TO dw_auth;--> statement-breakpoint
GRANT SELECT, INSERT ON auth_users TO dw_app;--> statement-breakpoint
GRANT UPDATE (name, role, status, updated_at) ON auth_users TO dw_app;--> statement-breakpoint
GRANT INSERT ON auth_users TO dw_platform;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Sessões, contas (senha), verificações, MFA e passkeys: exclusivos do dw_auth
-- ---------------------------------------------------------------------------
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE auth_sessions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY auth_sessions_auth ON auth_sessions FOR ALL TO dw_auth USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_sessions TO dw_auth;--> statement-breakpoint

ALTER TABLE auth_accounts ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE auth_accounts FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY auth_accounts_auth ON auth_accounts FOR ALL TO dw_auth USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_accounts TO dw_auth;--> statement-breakpoint

ALTER TABLE auth_verifications ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE auth_verifications FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY auth_verifications_auth ON auth_verifications FOR ALL TO dw_auth USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_verifications TO dw_auth;--> statement-breakpoint

ALTER TABLE auth_two_factors ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE auth_two_factors FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY auth_two_factors_auth ON auth_two_factors FOR ALL TO dw_auth USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_two_factors TO dw_auth;--> statement-breakpoint

ALTER TABLE auth_passkeys ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE auth_passkeys FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY auth_passkeys_auth ON auth_passkeys FOR ALL TO dw_auth USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_passkeys TO dw_auth;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- user_invitations
-- ---------------------------------------------------------------------------
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE user_invitations FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY user_invitations_app ON user_invitations FOR ALL TO dw_app
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());--> statement-breakpoint
CREATE POLICY user_invitations_platform ON user_invitations FOR INSERT TO dw_platform WITH CHECK (true);--> statement-breakpoint
CREATE POLICY user_invitations_auth ON user_invitations FOR ALL TO dw_auth USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT, INSERT ON user_invitations TO dw_app;--> statement-breakpoint
GRANT INSERT ON user_invitations TO dw_platform;--> statement-breakpoint
GRANT SELECT ON user_invitations TO dw_auth;--> statement-breakpoint
GRANT UPDATE (used_at) ON user_invitations TO dw_auth;
