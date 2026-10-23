'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { AppShell, Card, PageHeader, SourceLine, useMe } from '@/components/app-shell';
import { CompliancePill, ConnectivityPill, Observed } from '@/components/status';
import { Alert, Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { MANUFACTURER } from '@/lib/format';
import type { DeviceList, PolicySummary } from '@/lib/types';

export default function AparelhosPage() {
  return (
    <AppShell>
      <Suspense>
        <Aparelhos />
      </Suspense>
    </AppShell>
  );
}

const SELECT =
  'rounded-xl border border-border bg-surface px-3 py-2 text-[14px] text-text focus:border-royal focus:outline-none';

function Aparelhos() {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const isAdmin = me.user.role === 'admin';
  const [data, setData] = useState<DeviceList>();
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string>();

  const qs = params.toString();
  const load = useCallback(() => {
    const q = new URLSearchParams(qs);
    if (!q.get('pageSize')) q.set('pageSize', '25');
    void api<DeviceList>(`/devices?${q.toString()}`).then(setData);
  }, [qs]);
  useEffect(() => {
    load();
    setSelected(new Set());
  }, [load]);
  useEffect(() => {
    void api<PolicySummary[]>('/policies').then(setPolicies);
  }, []);

  const pageIds = data?.items.map((d) => d.id) ?? [];
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Busca com pequena espera para não consultar a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('search') ?? '') !== search) set('search', search);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function set(key: string, value: string | null) {
    const q = new URLSearchParams(params.toString());
    if (value) q.set(key, value);
    else q.delete(key);
    if (key !== 'page') q.delete('page');
    router.replace(`${pathname}?${q.toString()}`);
  }

  const page = Number(params.get('page') ?? 1);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Aparelhos"
        subtitle={data ? <SourceLine at={data.generatedAt} source={data.source} /> : undefined}
        actions={
          me.user.role === 'admin' && (
            <Link href="/aparelhos/cadastrar">
              <Button>Cadastrar aparelho</Button>
            </Link>
          )
        }
      />
      <Card i={1}>
        <div className="mb-4 flex flex-wrap gap-2.5" role="search">
          <label className="sr-only" htmlFor="busca">
            Buscar aparelho
          </label>
          <input
            id="busca"
            type="search"
            placeholder="Buscar por nome, modelo, série ou responsável…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${SELECT} min-w-[260px] flex-1`}
          />
          <select
            aria-label="Comunicação"
            className={SELECT}
            value={params.get('connectivity') ?? ''}
            onChange={(e) => set('connectivity', e.target.value || null)}
          >
            <option value="">Toda comunicação</option>
            <option value="online">Com sinal (24 h)</option>
            <option value="silent">Sem sinal há +24 h</option>
            <option value="unknown">Desconhecido</option>
          </select>
          <select
            aria-label="Fabricante"
            className={SELECT}
            value={params.get('manufacturer') ?? ''}
            onChange={(e) => set('manufacturer', e.target.value || null)}
          >
            <option value="">Todos os fabricantes</option>
            <option value="samsung">Samsung</option>
            <option value="motorola">Motorola</option>
          </select>
          <select
            aria-label="Versão do Android"
            className={SELECT}
            value={params.get('android') ?? ''}
            onChange={(e) => set('android', e.target.value || null)}
          >
            <option value="">Todas as versões</option>
            {[12, 13, 14, 15].map((v) => (
              <option key={v} value={v}>
                Android {v}
              </option>
            ))}
          </select>
          <select
            aria-label="Responsável"
            className={SELECT}
            value={params.get('holder') ?? ''}
            onChange={(e) => set('holder', e.target.value || null)}
          >
            <option value="">Com e sem responsável</option>
            <option value="assigned">Com responsável</option>
            <option value="unassigned">Sem responsável</option>
          </select>
          <select
            aria-label="Política"
            className={SELECT}
            value={params.get('policy') ?? ''}
            onChange={(e) => set('policy', e.target.value || null)}
          >
            <option value="">Todas as políticas</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Conformidade"
            className={SELECT}
            value={params.get('compliance') ?? ''}
            onChange={(e) => set('compliance', e.target.value || null)}
          >
            <option value="">Toda conformidade</option>
            <option value="compliant">Conforme</option>
            <option value="noncompliant">Não conforme</option>
            <option value="unknown">Desconhecido</option>
            <option value="not_applicable">Sem política</option>
          </select>
        </div>

        {notice && (
          <div className="mb-4">
            <Alert tone="ok">{notice}</Alert>
          </div>
        )}
        {isAdmin && selected.size > 0 && (
          <BulkPolicy
            ids={[...selected]}
            policies={policies}
            onDone={(message) => {
              setNotice(message);
              setSelected(new Set());
              load();
            }}
          />
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-[13.5px]">
            <caption className="sr-only">Lista de aparelhos</caption>
            <thead>
              <tr className="border-b border-border text-left text-[12px] font-bold text-muted">
                {isAdmin && (
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos desta página"
                      className="h-4 w-4 accent-[var(--royal)]"
                      checked={allOnPage}
                      onChange={() =>
                        setSelected((cur) => {
                          const next = new Set(cur);
                          for (const id of pageIds) {
                            if (allOnPage) next.delete(id);
                            else next.add(id);
                          }
                          return next;
                        })
                      }
                    />
                  </th>
                )}
                <th className="px-3 py-2.5">Aparelho</th>
                <th className="px-3 py-2.5">Responsável</th>
                <th className="px-3 py-2.5">Android</th>
                <th className="px-3 py-2.5">Comunicação</th>
                <th className="px-3 py-2.5">Política</th>
                <th className="px-3 py-2.5">Bateria</th>
                <th className="px-3 py-2.5">Armazenamento livre</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                  {isAdmin && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${d.displayName}`}
                        className="h-4 w-4 accent-[var(--royal)]"
                        checked={selected.has(d.id)}
                        onChange={() => toggle(d.id)}
                      />
                    </td>
                  )}
                  <td className="px-3 py-3">
                    <Link href={`/aparelhos/${d.id}`} className="font-bold text-text hover:text-royal">
                      {d.displayName}
                    </Link>
                    <div className="text-[12px] text-muted">
                      {MANUFACTURER[d.manufacturer]} {d.model}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {d.holder?.name ?? <span className="text-muted">Sem responsável</span>}
                  </td>
                  <td className="px-3 py-3">{d.androidVersion}</td>
                  <td className="px-3 py-3">
                    <ConnectivityPill value={d.connectivity} lastSeenAt={d.lastSeenAt} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-[12.5px] font-semibold">{d.policy?.name ?? '—'}</span>
                      <CompliancePill status={d.compliance.status} at={d.compliance.evaluatedAt} />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Observed value={d.battery?.value} at={d.battery?.observedAt} suffix="%" />
                  </td>
                  <td className="px-3 py-3">
                    <Observed value={d.storageFree?.value} at={d.storageFree?.observedAt} suffix="%" />
                  </td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-3 py-10 text-center text-text-2">
                    Nenhum aparelho encontrado com estes filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-text-2">
            <span>
              {data.total} aparelho{data.total === 1 ? '' : 's'} · página {page} de {pages}
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => set('page', String(page - 1))}>
                Anterior
              </Button>
              <Button
                variant="secondary"
                disabled={page >= pages}
                onClick={() => set('page', String(page + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

/** Troca a política de vários aparelhos de uma vez (somente administradores). */
function BulkPolicy({
  ids,
  policies,
  onDone,
}: {
  ids: string[];
  policies: PolicySummary[];
  onDone: (message: string) => void;
}) {
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(undefined);
    try {
      const r = await api<{ changed: number; unchanged: number }>('/devices/policy', {
        method: 'POST',
        body: JSON.stringify({
          deviceIds: ids,
          policyId: String(f.get('policyId')) || null,
          reason: String(f.get('reason')),
        }),
      });
      onDone(
        `${r.changed} aparelho(s) atualizado(s)${r.unchanged ? `, ${r.unchanged} já estavam com esta política` : ''}. ` +
          'A aplicação acontece na próxima comunicação de cada aparelho.',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Definir política dos selecionados"
      className="dw-rise mb-4 flex flex-wrap items-end gap-2.5 rounded-xl border border-sky bg-ice p-3"
    >
      <strong className="self-center text-[14px] text-royal">{ids.length} selecionado(s)</strong>
      <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
        Nova política
        <select name="policyId" className={SELECT} defaultValue={policies[0]?.id ?? ''}>
          {policies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="">Sem política</option>
        </select>
      </label>
      <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[12.5px] font-semibold">
        Motivo (fica na auditoria)
        <input
          name="reason"
          required
          minLength={3}
          maxLength={300}
          className={SELECT}
          placeholder="Ex.: equipe remanejada"
        />
      </label>
      <Button type="submit">Aplicar aos selecionados</Button>
      {error && (
        <div className="w-full">
          <Alert>{error}</Alert>
        </div>
      )}
    </form>
  );
}
