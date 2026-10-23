'use client';

import {
  COMMAND_LABEL,
  COMMAND_STATE_LABEL,
  COMMAND_STATES,
  COMMAND_TYPES,
  FINAL_STATES,
} from '@dw/contracts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { AppShell, Card, PageHeader, SourceLine, useMe } from '@/components/app-shell';
import { CommandCard, INPUT, MfaField } from '@/components/commands';
import { Dialog } from '@/components/dialog';
import { Pill } from '@/components/status';
import { Alert, Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { dateTime, relative } from '@/lib/format';
import type { BatchItem, CommandList } from '@/lib/types';

export default function ComandosPage() {
  return (
    <AppShell>
      <Suspense>
        <Comandos />
      </Suspense>
    </AppShell>
  );
}

function Comandos() {
  const me = useMe();
  const isAdmin = me.user.role === 'admin';
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [data, setData] = useState<CommandList>();
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [notice, setNotice] = useState<string>();

  const qs = params.toString();
  const load = useCallback(() => {
    void api<CommandList>(`/commands?${qs}`).then(setData);
    void api<BatchItem[]>('/commands/batches?status=waiting_approval').then(setBatches);
  }, [qs]);
  useEffect(load, [load]);
  // Atualiza sozinho enquanto houver comando a caminho do aparelho.
  const moving = data?.items.some((c) => !FINAL_STATES.includes(c.state) && c.state !== 'waiting_approval');
  useEffect(() => {
    if (!moving) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [moving, load]);

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
        title="Comandos"
        subtitle={data ? <SourceLine at={data.generatedAt} source={data.source} /> : undefined}
      />

      <Card title={`Aguardando aprovação (${batches.length})`} i={1}>
        <p className="-mt-2 mb-4 text-[13px] text-muted">
          Apagar vários aparelhos de uma vez precisa de um segundo administrador. Quem pediu não pode aprovar.
        </p>
        {notice && (
          <div className="mb-3">
            <Alert tone="ok">{notice}</Alert>
          </div>
        )}
        {batches.length === 0 ? (
          <p className="text-text-2">Nenhum pedido aguardando aprovação.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {batches.map((b) => (
              <Approval
                key={b.id}
                b={b}
                isAdmin={isAdmin}
                onDone={(msg) => {
                  setNotice(msg);
                  load();
                }}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Histórico de comandos" i={2}>
        <div className="mb-4 flex flex-wrap gap-2.5">
          <select
            aria-label="Situação"
            className={INPUT}
            value={params.get('pending') ? 'pending' : (params.get('state') ?? '')}
            onChange={(e) => {
              const v = e.target.value;
              const q = new URLSearchParams(params.toString());
              q.delete('page');
              q.delete('state');
              q.delete('pending');
              if (v === 'pending') q.set('pending', '1');
              else if (v) q.set('state', v);
              router.replace(`${pathname}?${q.toString()}`);
            }}
          >
            <option value="">Todas as situações</option>
            <option value="pending">Em andamento</option>
            {COMMAND_STATES.filter((s) => !['requested', 'validated', 'unknown'].includes(s)).map((s) => (
              <option key={s} value={s}>
                {COMMAND_STATE_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            aria-label="Tipo de comando"
            className={INPUT}
            value={params.get('type') ?? ''}
            onChange={(e) => set('type', e.target.value || null)}
          >
            <option value="">Todos os tipos</option>
            {COMMAND_TYPES.map((t) => (
              <option key={t} value={t}>
                {COMMAND_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        {data && data.items.length === 0 ? (
          <p className="py-6 text-center text-text-2">Nenhum comando com estes filtros.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {data?.items.map((c) => (
              <CommandCard key={c.id} cmd={c} canEdit={isAdmin} showDevice onChanged={load} />
            ))}
          </ul>
        )}
        {data && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-text-2">
            <span>
              {data.total} comando{data.total === 1 ? '' : 's'} · página {page} de {pages}
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

function Approval({ b, isAdmin, onDone }: { b: BatchItem; isAdmin: boolean; onDone: (msg: string) => void }) {
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'approve') {
        const r = await api<{ queued: number }>(`/commands/batches/${b.id}/approve`, {
          method: 'POST',
          body: JSON.stringify({
            mfaCode: String(f.get('mfaCode')),
            note: String(f.get('note') ?? '') || null,
          }),
        });
        onDone(`Aprovado: ${r.queued} comando(s) na fila.`);
      } else {
        await api(`/commands/batches/${b.id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ note: String(f.get('note')) }),
        });
        onDone('Pedido recusado. Os comandos foram cancelados.');
      }
      setMode(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível concluir.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-crit/40 p-4" data-testid="approval">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-crit">
          {COMMAND_LABEL[b.type]} · {b.deviceCount} aparelhos
        </strong>
        <span className="ml-auto">
          <Pill tone="warn">Aguardando aprovação</Pill>
        </span>
      </div>
      <p className="mt-1 text-[13px] text-text-2">
        Pedido por <strong>{b.requestedByName}</strong> {relative(b.createdAt)} · motivo: “{b.reason}”
        {b.expiresAt && <> · expira em {dateTime(b.expiresAt)}</>}
      </p>
      <p className="mt-1 text-[13px]">
        Aparelhos:{' '}
        {b.devices
          .slice(0, 8)
          .map((d) => d.name)
          .join(', ')}
        {b.devices.length > 8 && ` e mais ${b.devices.length - 8}`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {b.canDecide ? (
          <>
            <Button className="!bg-crit !shadow-none" onClick={() => setMode('approve')}>
              Aprovar apagamento…
            </Button>
            <Button variant="secondary" onClick={() => setMode('reject')}>
              Recusar…
            </Button>
          </>
        ) : isAdmin ? (
          <>
            <span className="self-center text-[13px] text-muted">
              Aguardando outro administrador aprovar.
            </span>
            <Button variant="secondary" onClick={() => setMode('reject')}>
              Retirar pedido…
            </Button>
          </>
        ) : (
          <span className="text-[13px] text-muted">Somente administradores decidem.</span>
        )}
      </div>
      <Dialog
        open={mode !== null}
        onClose={() => setMode(null)}
        danger={mode === 'approve'}
        title={mode === 'approve' ? `Aprovar apagamento de ${b.deviceCount} aparelhos?` : 'Recusar o pedido?'}
      >
        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === 'approve' ? (
            <div className="rounded-xl bg-crit-s p-3 text-[14px] text-crit">
              <p className="font-bold">IRREVERSÍVEL: os aparelhos voltam às configurações de fábrica.</p>
              <p>Tudo o que não foi sincronizado (pedidos, fotos) é perdido.</p>
            </div>
          ) : (
            <p className="text-[14px] text-text-2">Os comandos do pedido serão cancelados.</p>
          )}
          <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
            {mode === 'approve' ? 'Observação (opcional)' : 'Motivo (fica na auditoria)'}
            <input name="note" required={mode === 'reject'} minLength={3} maxLength={300} className={INPUT} />
          </label>
          {mode === 'approve' && <MfaField />}
          {error && <Alert>{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMode(null)}>
              Voltar
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className={mode === 'approve' ? '!bg-crit !shadow-none' : ''}
            >
              {mode === 'approve' ? 'Aprovar apagamento' : 'Recusar pedido'}
            </Button>
          </div>
        </form>
      </Dialog>
    </li>
  );
}
