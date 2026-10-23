# ADR-0005 — Administrador da plataforma sem acesso a dados de clientes; empresas criadas pela plataforma

- **Status:** Aceito · **Data:** 2026-10-23 · **Decisões:** CP3-6, CP3-7

## Decisão
- O papel **administrador da plataforma** **nunca** lê dados das empresas clientes (aparelhos, usuários
  finais, políticas, auditoria interna da empresa). Não existe “acesso de suporte” a dados.
- Ele **pode apenas**: criar empresa, convidar o primeiro administrador dela, suspender/reativar empresa,
  ver metadados de plataforma (nome da empresa, status, contagem agregada para limites) e iniciar
  **recuperação de acesso** do administrador da empresa (reset de MFA/convite novo) — sem ver dados.
- Toda ação de plataforma gera evento de auditoria visível também para a empresa afetada.
- Novas empresas **só** são criadas pela plataforma (sem autocadastro).
- Imposto no banco: papel `dw_platform` não tem permissão nas tabelas de dados de empresa.

## Consequências
- Suporte técnico a clientes acontece pelos próprios administradores da empresa (ou por exportações que eles
  enviarem). Isso precisa constar nos termos de uso futuros.
- A recuperação de acesso exige processo de verificação de identidade fora do sistema (definir no CP8).
- Empresa deve ter ao menos 2 administradores recomendados para evitar bloqueio.
