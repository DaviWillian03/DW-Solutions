// Rótulos da auditoria (M11). Ação desconhecida aparece pelo código — nunca some da lista.

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Entrada no sistema',
  'tenant.create': 'Empresa criada pela plataforma',
  'user.invite': 'Usuário convidado',
  'user.invitation_accepted': 'Convite aceito',
  'user.disable': 'Usuário desativado',
  'holder.create': 'Responsável cadastrado',
  'holder.update': 'Responsável alterado',
  'holder.deactivate': 'Responsável desativado',
  'enrollment.create': 'QR de cadastro gerado',
  'enrollment.simulated_scan': 'Leitura de QR simulada',
  'device.enrolled': 'Aparelho cadastrado',
  'device.rename': 'Aparelho renomeado',
  'device.holder_assign': 'Responsável do aparelho definido',
  'device.holder_remove': 'Responsável do aparelho removido',
  'policy.create': 'Política criada',
  'policy.version_create': 'Nova versão de política publicada',
  'device.policy_assign': 'Política do aparelho definida',
  'device.policy_remove': 'Política do aparelho removida',
  'command.request': 'Comando pedido',
  'command.batch_request': 'Comando em lote pedido',
  'command.batch_approve': 'Lote aprovado',
  'command.batch_reject': 'Lote recusado',
  'command.cancel': 'Comando cancelado',
  'command.location_view': 'Localização vista',
  'settings.update': 'Configuração alterada',
  'security.step_up': 'Verificação em duas etapas refeita',
  'simulator.seed': 'Dados de demonstração criados',
};

/** Grupos para o filtro da tela. */
export const AUDIT_GROUPS: Record<string, { label: string; prefix: string[] }> = {
  acesso: { label: 'Acesso e segurança', prefix: ['auth.', 'security.', 'user.', 'tenant.'] },
  aparelhos: { label: 'Aparelhos e cadastro', prefix: ['device.', 'enrollment.', 'holder.'] },
  politicas: { label: 'Políticas', prefix: ['policy.'] },
  comandos: { label: 'Comandos', prefix: ['command.'] },
  configuracoes: { label: 'Configurações', prefix: ['settings.'] },
};

export const AUDIT_OUTCOME_LABEL = {
  success: 'Concluída',
  denied: 'Negada',
  failure: 'Falhou',
} as const;
export type AuditOutcome = keyof typeof AUDIT_OUTCOME_LABEL;
