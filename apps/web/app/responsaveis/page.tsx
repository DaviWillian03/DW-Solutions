'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { AppShell, Card, PageHeader, useMe } from '@/components/app-shell';
import { Pill } from '@/components/status';
import { Alert, Button, Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { HOLDER_ROLE } from '@/lib/format';
import type { Holder } from '@/lib/types';

export default function ResponsaveisPage() {
  return (
    <AppShell>
      <Responsaveis />
    </AppShell>
  );
}

function Responsaveis() {
  const me = useMe();
  const admin = me.user.role === 'admin';
  const [list, setList] = useState<Holder[]>();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState<string>();

  const load = useCallback(() => {
    void api<Holder[]>(`/holders${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(setList);
  }, [search]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setError(undefined);
    setOk(undefined);
    try {
      await api('/holders', {
        method: 'POST',
        body: JSON.stringify({
          fullName: f.get('fullName'),
          employeeCode: String(f.get('employeeCode')).trim() || null,
          role: f.get('role'),
        }),
      });
      form.reset();
      setOk('Responsável cadastrado.');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    }
  }

  async function toggle(h: Holder) {
    await api(`/holders/${h.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: h.status === 'active' ? 'inactive' : 'active' }),
    });
    load();
  }

  return (
    <>
      <PageHeader
        title="Responsáveis"
        subtitle="Vendedores e promotores que ficam com os aparelhos. Eles não acessam o sistema."
      />
      <div className={`grid grid-cols-1 gap-6 ${admin ? 'lg:grid-cols-[2fr_1fr]' : ''}`}>
        <Card i={1}>
          <label className="sr-only" htmlFor="busca-resp">
            Buscar responsável
          </label>
          <input
            id="busca-resp"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou matrícula…"
            className="mb-4 w-full rounded-xl border border-border bg-surface px-3 py-2 text-[14px]"
          />
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13.5px]">
              <caption className="sr-only">Responsáveis</caption>
              <thead>
                <tr className="border-b border-border text-left text-[12px] font-bold text-muted">
                  <th className="px-3 py-2.5">Nome</th>
                  <th className="px-3 py-2.5">Matrícula</th>
                  <th className="px-3 py-2.5">Área</th>
                  <th className="px-3 py-2.5">Aparelhos</th>
                  <th className="px-3 py-2.5">Situação</th>
                  {admin && <th className="px-3 py-2.5">Ação</th>}
                </tr>
              </thead>
              <tbody>
                {list?.map((h) => (
                  <tr key={h.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 font-semibold">{h.fullName}</td>
                    <td className="px-3 py-2.5">{h.employeeCode ?? '—'}</td>
                    <td className="px-3 py-2.5">{HOLDER_ROLE[h.role]}</td>
                    <td className="px-3 py-2.5">{h.devices}</td>
                    <td className="px-3 py-2.5">
                      <Pill tone={h.status === 'active' ? 'ok' : 'unk'}>
                        {h.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Pill>
                    </td>
                    {admin && (
                      <td className="px-3 py-2.5">
                        <Button variant="ghost" onClick={() => toggle(h)}>
                          {h.status === 'active' ? 'Desativar' : 'Reativar'}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {admin && (
          <Card title="Novo responsável" i={2}>
            <form onSubmit={create} className="flex flex-col gap-3.5">
              {error && <Alert>{error}</Alert>}
              {ok && <Alert tone="ok">{ok}</Alert>}
              <Field label="Nome completo" name="fullName" required minLength={2} maxLength={120} />
              <Field label="Matrícula (opcional)" name="employeeCode" maxLength={30} />
              <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
                Área
                <select
                  name="role"
                  defaultValue="sales"
                  className="rounded-xl border border-border bg-surface px-3 py-2.5 font-normal"
                >
                  <option value="sales">Vendas</option>
                  <option value="merchandising">Merchandising</option>
                  <option value="other">Outra</option>
                </select>
              </label>
              <div>
                <Button type="submit">Cadastrar responsável</Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
