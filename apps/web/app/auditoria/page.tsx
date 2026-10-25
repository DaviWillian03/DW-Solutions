'use client';

import { AUDIT_ACTION_LABEL, AUDIT_GROUPS, AUDIT_OUTCOME_LABEL, type AuditOutcome } from '@dw/contracts';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Fragment, Suspense, useCallback, useEffect, useState } from 'react';
import { AppShell, Card, PageHeader, SourceLine, useMe } from '@/components/app-shell';
import { INPUT } from '@/components/commands';
import { Pill } from '@/components/status';
import { Alert, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';

export default function AuditoriaPage() {
  return (
    <AppShell>
      <Suspense>
        <Auditoria />
      </Suspense>
    </AppShell>
  );
}

interface AuditRow {
  seq: number;
  occurredAt: string;
  action: string;
  outcome: AuditOutcome;
  actorType: string;
  actorName: string | null;
  target: { type: string; id: string; name: string | null } | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  requestId: string | null;
  sourceIp: string | null;
}
interface AuditList {
  items: AuditRow[];
  actors: { id: string; name: string }[];
  total: number;
  page: number;
  pageSize: number;
  generatedAt: string;
  source: string;
}
interface Verify {
  ok: boolean;
  events: number;
  lastSeq: number;
  problems: { seq: number; problem: string }[];
  verifiedAt: string;
}

const OUTCOME_TONE = { success: 'ok', denied: 'crit', failure: 'warn' } as const;
const TARGET_LABEL: Record<string, string> = {
  device: 'Aparelho',
  policy: 'Política',
  user: 'Usuário',
  holder: 'Responsável',
  enrollment: 'Cadastro',
  command: 'Comando',
  batch: 'Lote',
  devices: 'Aparelhos',
  session: 'Sessão',
};

function Target({ t }: { t: AuditRow['target'] }) {
  if (!t) return <span className="text-muted">—</span>;
  const label = TARGET_LABEL[t.type] ?? t.type;
  const href = t.type === 'device' ? `/aparelhos/${t.id}` : t.type === 'policy' ? `/politicas/${t.id}` : null;
  const text = t.name ?? (t.id ? `${t.id.slice(0, 8)}…` : 'vários (ver detalhes)');
  return (
    <span>
      <span className="text-muted">{label}: </span>
      {href ? (
        <Link href={href} className="font-semibold text-royal">
          {text}
        </Link>
      ) : (
        <span className="font-semibold">{text}</span>
      )}
    </span>
  );
}

function Auditoria() {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [data, setData] = useState<AuditList>();
  const [verify, setVerify] = useState<Verify>();
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const isAdmin = me.user.role === 'admin';

  const qs = params.toString();
  useEffect(() => {
    if (isAdmin) void api<AuditList>(`/audit?${qs}`).then(setData);
  }, [qs, isAdmin]);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setVerify(await api<Verify>('/audit/verify'));
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    if (isAdmin) void check();
  }, [check, isAdmin]);

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

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Auditoria" />
        <Card>
          <p className="text-text-2">
            Somente administradores consultam a auditoria: ela contém dados de acesso (horário e endereço IP)
            de outras pessoas.
          </p>
        </Card>
      </>
    );
  }

  const page = Number(params.get('page') ?? 1);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Auditoria"
        subtitle={
          data ? (
            <SourceLine at={data.generatedAt} source={data.source} />
          ) : (
            'Quem fez o quê, quando e por quê.'
          )
        }
      />

      <Card title="Integridade do registro" i={1}>
        <p className="-mt-2 mb-3 text-[13px] text-muted">
          Cada registro guarda um resumo criptográfico (hash) do anterior. Se alguém alterar ou apagar um
          registro direto no banco, a verificação aponta onde.
        </p>
        {verify &&
          (verify.ok ? (
            <Alert tone="ok">
              Íntegro: {verify.events} registros conferidos (nº 1 a {verify.lastSeq}) em{' '}
              {dateTime(verify.verifiedAt)}.
            </Alert>
          ) : (
            <Alert>
              Problemas encontrados:{' '}
              {verify.problems.map((p) => `registro nº ${p.seq}: ${p.problem}`).join('; ')}. Avise o
              responsável pela segurança.
            </Alert>
          ))}
        <div className="mt-3">
          <Button variant="secondary" onClick={() => void check()} disabled={checking}>
            Verificar agora
          </Button>
        </div>
      </Card>

      <Card i={2}>
        <div className="mb-4 flex flex-wrap gap-2.5" role="search">
          <select
            aria-label="Assunto"
            className={INPUT}
            value={params.get('group') ?? ''}
            onChange={(e) => set('group', e.target.value || null)}
          >
            <option value="">Todos os assuntos</option>
            {Object.entries(AUDIT_GROUPS).map(([k, g]) => (
              <option key={k} value={k}>
                {g.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Resultado"
            className={INPUT}
            value={params.get('outcome') ?? ''}
            onChange={(e) => set('outcome', e.target.value || null)}
          >
            <option value="">Todos os resultados</option>
            {Object.entries(AUDIT_OUTCOME_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <select
            aria-label="Quem"
            className={INPUT}
            value={params.get('actorId') ?? ''}
            onChange={(e) => set('actorId', e.target.value || null)}
          >
            <option value="">Todas as pessoas</option>
            {data?.actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-[13px] text-text-2">
            De
            <input
              type="date"
              aria-label="Data inicial"
              className={INPUT}
              value={params.get('from') ?? ''}
              onChange={(e) => set('from', e.target.value || null)}
            />
          </label>
          <label className="flex items-center gap-1.5 text-[13px] text-text-2">
            até
            <input
              type="date"
              aria-label="Data final"
              className={INPUT}
              value={params.get('to') ?? ''}
              onChange={(e) => set('to', e.target.value || null)}
            />
          </label>
          <input
            type="search"
            aria-label="Buscar no motivo"
            placeholder="Buscar no motivo…"
            className={`${INPUT} min-w-[200px] flex-1`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {params.get('targetId') && (
            <Button variant="ghost" onClick={() => set('targetId', null)}>
              Mostrar todos os alvos
            </Button>
          )}
        </div>

        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[13.5px]">
            <caption className="sr-only">Registros de auditoria</caption>
            <thead>
              <tr className="border-b border-border text-left text-[12px] font-bold text-muted">
                <th className="px-3 py-2.5">Nº</th>
                <th className="px-3 py-2.5">Quando</th>
                <th className="px-3 py-2.5">Quem</th>
                <th className="px-3 py-2.5">O quê</th>
                <th className="px-3 py-2.5">Alvo</th>
                <th className="px-3 py-2.5">Resultado</th>
                <th className="px-3 py-2.5">Motivo</th>
                <th className="px-3 py-2.5">
                  <span className="sr-only">Detalhes</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((e) => (
                <Fragment key={e.seq}>
                  <tr className="border-b border-border align-top hover:bg-surface-2">
                    <td className="px-3 py-2.5 text-muted">{e.seq}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{dateTime(e.occurredAt)}</td>
                    <td className="px-3 py-2.5">{e.actorName ?? '—'}</td>
                    <td className="px-3 py-2.5 font-semibold">{AUDIT_ACTION_LABEL[e.action] ?? e.action}</td>
                    <td className="px-3 py-2.5">
                      <Target t={e.target} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill tone={OUTCOME_TONE[e.outcome]}>{AUDIT_OUTCOME_LABEL[e.outcome]}</Pill>
                    </td>
                    <td className="max-w-[260px] px-3 py-2.5 text-text-2">{e.reason ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        aria-expanded={open === e.seq}
                        onClick={() => setOpen(open === e.seq ? null : e.seq)}
                        className="text-[12.5px] font-bold text-royal"
                      >
                        {open === e.seq ? 'Ocultar' : 'Detalhes'}
                      </button>
                    </td>
                  </tr>
                  {open === e.seq && (
                    <tr className="border-b border-border bg-surface-2">
                      <td colSpan={8} className="px-3 py-3 text-[12.5px]">
                        <div className="mb-1 text-text-2">
                          Código: <code>{e.action}</code> · requisição: <code>{e.requestId ?? '—'}</code> ·
                          IP: <code>{e.sourceIp ?? '—'}</code>
                        </div>
                        <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface p-2.5">
                          {JSON.stringify(e.metadata, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-text-2">
                    Nenhum registro com estes filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-text-2">
            <span>
              {data.total} registro{data.total === 1 ? '' : 's'} · página {page} de {pages}
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
