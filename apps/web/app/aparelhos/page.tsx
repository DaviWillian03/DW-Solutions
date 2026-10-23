'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AppShell, Card, PageHeader, SourceLine, useMe } from '@/components/app-shell';
import { ConnectivityPill, Observed } from '@/components/status';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { MANUFACTURER } from '@/lib/format';
import type { DeviceList } from '@/lib/types';

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
  const [data, setData] = useState<DeviceList>();
  const [search, setSearch] = useState(params.get('search') ?? '');

  const qs = params.toString();
  useEffect(() => {
    const q = new URLSearchParams(qs);
    if (!q.get('pageSize')) q.set('pageSize', '25');
    void api<DeviceList>(`/devices?${q.toString()}`).then(setData);
  }, [qs]);

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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[13.5px]">
            <caption className="sr-only">Lista de aparelhos</caption>
            <thead>
              <tr className="border-b border-border text-left text-[12px] font-bold text-muted">
                <th className="px-3 py-2.5">Aparelho</th>
                <th className="px-3 py-2.5">Responsável</th>
                <th className="px-3 py-2.5">Android</th>
                <th className="px-3 py-2.5">Comunicação</th>
                <th className="px-3 py-2.5">Bateria</th>
                <th className="px-3 py-2.5">Armazenamento livre</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-surface-2">
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
                    <Observed value={d.battery?.value} at={d.battery?.observedAt} suffix="%" />
                  </td>
                  <td className="px-3 py-3">
                    <Observed value={d.storageFree?.value} at={d.storageFree?.observedAt} suffix="%" />
                  </td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-text-2">
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
