# ADR-0003 — Autenticação com Better Auth, MFA por app autenticador e chave de acesso

- **Status:** Aceito · **Data:** 2026-10-23 · **Decisões:** CP3-1, CP3-5

## Contexto
O prompt-mestre exige autenticação robusta, MFA para administração, sessões seguras e nenhuma senha padrão.
Restrições: R$ 0, container sem Docker. Opções avaliadas: Better Auth, Keycloak, serviço gerenciado, do zero.

## Decisão
- **Better Auth** embutido na API (escolha do usuário), atrás de uma interface própria `AuthPort` para permitir
  trocar por Keycloak/OIDC no futuro.
- **MFA:** app autenticador (TOTP, plugin `two-factor`) **e** chave de acesso/passkey (`@better-auth/passkey`),
  com **códigos de recuperação** (necessários para não perder a conta). MFA **obrigatório** para papéis
  administrativos; recomendado para os demais.
- Sessões no PostgreSQL; cookie `HttpOnly; Secure; SameSite=Lax`; expiração e revogação testadas
  (logout, troca de senha, desativação de usuário).
- CSRF: verificação de `Origin`/`Host` + token anti-CSRF em métodos que alteram dados.
- **Proteções contra falhas conhecidas da biblioteca (alertas de 2026):**
  - usar versão ≥ 1.7.x corrigida e atualizar em até 7 dias após alerta de segurança;
  - **não** habilitar `session.cookieCache` (bypass de 2FA em versões antigas);
  - **não** habilitar plugins não usados (OIDC provider, device authorization, MCP);
  - rate limit próprio nas rotas de login/recuperação, agrupando IPv6 por /64;
  - testes automatizados de: login sem 2FA concluído não acessa nada; sessão revogada não funciona.
- Desenvolvimento: usuário inicial criado por script com senha **aleatória** exibida uma única vez; nunca senha fixa.

## Consequências
- Responsabilidade de acompanhar alertas de segurança da biblioteca (Dependabot + revisão).
- Passkeys exigem HTTPS ou `localhost`; nos testes E2E usaremos o autenticador virtual do Chromium.
- SSO corporativo (Google Workspace/Microsoft Entra) fica para depois, por plugin ou migração ao Keycloak.

## Notas de implementação (Fase A3a, 2026-10-23)
- Better Auth **1.7.10** (mais nova com ≥ 7 dias), passkey 1.7.10. Tabelas conferidas com `getAuthTables`.
- Papel de banco exclusivo **`dw_auth`**: lê identidades e gerencia sessões/MFA/passkeys, mas **não cria
  usuários** nem altera empresa, perfil ou situação (permissões por coluna) — falha na biblioteca não
  permite escalar privilégio. Usuários são criados por convite (`dw_app` com RLS) ou pela plataforma (só admin).
- A biblioteca desliga a checagem de origem em ambiente de teste e não confere origem em login sem cookie:
  configurado `disableOriginCheck: false` e checagem própria de `Origin` em todo POST de `/api/auth/*`.
- Bloqueio por conta (10 falhas/15 min por e-mail, em Redis) além do limite por IP da biblioteca.
- Convites: token de 256 bits só no fragmento da URL (`/convite#…`), guardado como SHA-256, 48 h, uso único.
- Administrador sem TOTP cadastrado só acessa `/api/me` (403 `MFA_ENROLLMENT_REQUIRED`).
