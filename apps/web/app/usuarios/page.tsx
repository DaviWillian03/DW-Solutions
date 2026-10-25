'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { AppShell, Card, PageHeader, useMe } from '@/components/app-shell';
import { Pill } from '@/components/status';
import { Alert, Button, Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { dateOnly } from '@/lib/format';
import type { UserRow } from '@/lib/types';

export default function UsuariosPage() {
  return (
    <AppShell>
      <Usuarios />
    </AppShell>
  );
}

function Usuarios() {
  const me = useMe();
  const admin = me.user.role === 'admin';
  const [users, setUsers] = useState<UserRow[]>();
  const [invite, setInvite] = useState<{ url: string; email: string }>();
  const [error, setError] = useState<string>();

  const load = useCallback(() => void api<UserRow[]>('/users').then(setUsers), []);
  useEffect(load, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setError(undefined);
    try {
      const r = await api<{ inviteUrl: string }>('/users/invite', {
        method: 'POST',
        body: JSON.stringify({ name: f.get('name'), email: f.get('email'), role: f.get('role') }),
      });
      setInvite({ url: r.inviteUrl, email: String(f.get('email')) });
      form.reset();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível convidar.');
    }
  }

  async function disable(u: UserRow) {
    const reason = window.prompt(`Motivo para desativar ${u.name} (fica na auditoria):`);
    if (!reason || reason.trim().length < 5) return;
    try {
      await api(`/users/${u.id}/disable`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível desativar.');
    }
  }

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Pessoas que acessam o painel. Administradores usam verificação em duas etapas obrigatória."
      />
      {error && <Alert>{error}</Alert>}
      <div className={`grid grid-cols-1 gap-6 ${admin ? 'lg:grid-cols-[2fr_1fr]' : ''}`}>
        <Card i={1}>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[620px] text-[13.5px]">
              <caption className="sr-only">Usuários</caption>
              <thead>
                <tr className="border-b border-border text-left text-[12px] font-bold text-muted">
                  <th className="px-3 py-2.5">Nome</th>
                  <th className="px-3 py-2.5">Perfil</th>
                  <th className="px-3 py-2.5">Duas etapas</th>
                  <th className="px-3 py-2.5">Situação</th>
                  <th className="px-3 py-2.5">Desde</th>
                  {admin && <th className="px-3 py-2.5">Ação</th>}
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-[12px] text-muted">{u.email}</div>
                    </td>
                    <td className="px-3 py-2.5">{u.role === 'admin' ? 'Administrador' : 'Leitura'}</td>
                    <td className="px-3 py-2.5">
                      <Pill tone={u.twoFactorEnabled ? 'ok' : 'warn'}>
                        {u.twoFactorEnabled ? 'Ativa' : 'Não cadastrada'}
                      </Pill>
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill tone={u.status === 'active' ? 'ok' : 'unk'}>
                        {u.status === 'active' ? 'Ativo' : 'Desativado'}
                      </Pill>
                    </td>
                    <td className="px-3 py-2.5">{dateOnly(u.createdAt.slice(0, 10))}</td>
                    {admin && (
                      <td className="px-3 py-2.5">
                        {u.id !== me.user.id && u.status === 'active' && (
                          <Button variant="ghost" onClick={() => disable(u)}>
                            Desativar
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {admin && (
          <Card title="Convidar usuário" i={2}>
            {invite ? (
              <div className="flex flex-col gap-3">
                <Alert tone="ok">Convite criado para {invite.email}.</Alert>
                <p className="text-[13px] text-text-2">
                  Envie este link por um canal seguro. Ele vale por 48 horas, funciona uma única vez e{' '}
                  <strong>não será mostrado de novo</strong>.
                </p>
                <code
                  data-testid="invite-url"
                  className="break-all rounded-lg bg-surface-2 p-2.5 text-[12.5px]"
                >
                  {invite.url}
                </code>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => void navigator.clipboard?.writeText(invite.url)}>
                    Copiar link
                  </Button>
                  <Button variant="ghost" onClick={() => setInvite(undefined)}>
                    Novo convite
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={create} className="flex flex-col gap-3.5">
                <Field label="Nome" name="name" required minLength={2} maxLength={120} />
                <Field label="E-mail" name="email" type="email" required />
                <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
                  Perfil
                  <select
                    name="role"
                    defaultValue="viewer"
                    className="rounded-xl border border-border bg-surface px-3 py-2.5 font-normal"
                  >
                    <option value="viewer">Leitura (só consulta)</option>
                    <option value="admin">Administrador (MFA obrigatório)</option>
                  </select>
                </label>
                <div>
                  <Button type="submit">Gerar convite</Button>
                </div>
              </form>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
