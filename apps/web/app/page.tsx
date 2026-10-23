'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell, Card, PageHeader, SourceLine, useMe } from '@/components/app-shell';
import { ConnectivityPill } from '@/components/status';
import { api } from '@/lib/api';
import { MANUFACTURER, relative } from '@/lib/format';
import type { Summary } from '@/lib/types';

export default function HomePage() {
  return (
    <AppShell>
      <Overview />
    </AppShell>
  );
}

function Bars({ rows, total }: { rows: { label: string; n: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <figure className="flex flex-col gap-3">
      {rows.map((r) => (
        <div
          key={r.label}
          className="grid grid-cols-[100px_1fr_80px] items-center gap-3 text-[13.5px]"
          title={`${r.label}: ${r.n} aparelhos (${Math.round((r.n / total) * 100)}%)`}
        >
          <span className="text-text-2">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded bg-surface-2">
            <span
              className="dw-bar block h-full rounded-r bg-royal"
              style={{ width: `${(r.n / max) * 100}%` }}
            />
          </span>
          <span className="text-right font-bold">
            {r.n} <small className="font-semibold text-muted">{Math.round((r.n / total) * 100)}%</small>
          </span>
        </div>
      ))}
    </figure>
  );
}

function Kpi({
  label,
  value,
  hint,
  href,
  tone,
  i,
}: {
  label: string;
  value: number;
  hint: string;
  href: string;
  tone: string;
  i: number;
}) {
  return (
    <Link
      href={href}
      className="dw-rise rounded-[18px] border border-border bg-surface p-5 shadow-[var(--shadow)] transition-transform hover:-translate-y-0.5 hover:border-sky"
      style={{ ['--i' as string]: i }}
    >
      <div className={`text-[30px] font-extrabold tracking-tight ${tone}`}>{value}</div>
      <div className="text-[13.5px] font-bold">{label}</div>
      <div className="text-[12.5px] text-muted">{hint}</div>
    </Link>
  );
}

function Overview() {
  const me = useMe();
  const [s, setS] = useState<Summary>();

  useEffect(() => {
    void api<Summary>('/devices/summary').then(setS);
  }, []);

  if (!s) return <p className="text-muted">Carregando…</p>;
  const c = s.counts;
  const pct = c.total ? Math.round((c.online / c.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle={
          <>
            <span className="font-semibold">
              Olá, {me.user.name.split(' ')[0]} · {me.tenant.name}
            </span>
            <SourceLine at={s.generatedAt} source={s.source} />
          </>
        }
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <Link
          href="/aparelhos"
          className="dw-rise relative overflow-hidden rounded-[18px] p-6 text-white shadow-[0_12px_30px_rgba(26,79,214,.28)] md:col-span-2 xl:col-span-1"
          style={{ background: 'linear-gradient(135deg,#0A1F4D 0%,#1A4FD6 100%)' }}
        >
          <div className="text-[13px] font-semibold text-[#C9DAFF]">Aparelhos gerenciados</div>
          <div className="mt-1 text-[40px] font-extrabold leading-tight tracking-tight">
            {c.total}{' '}
            <small className="text-[15px] font-semibold text-[#C9DAFF]">
              · {c.online} com sinal nas últimas 24 h
            </small>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded bg-white/20">
            <span className="dw-bar block h-full rounded-r bg-white" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 text-[13px] text-[#DCE7FF]">{pct}% da frota comunicou nas últimas 24 h</div>
        </Link>
        <Kpi
          i={1}
          label="Sem sinal"
          value={c.silent}
          hint={`há mais de ${s.silentAfterHours} h`}
          href="/aparelhos?connectivity=silent"
          tone="text-crit"
        />
        <Kpi
          i={2}
          label="Desconhecido"
          value={c.unknown}
          hint="nunca comunicaram"
          href="/aparelhos?connectivity=unknown"
          tone="text-unk"
        />
        <Kpi
          i={3}
          label="Sem responsável"
          value={c.unassigned}
          hint="reserva ou estoque"
          href="/aparelhos?holder=unassigned"
          tone="text-warn"
        />
        <Kpi
          i={4}
          label="Cadastros pendentes"
          value={c.pendingEnrollments}
          hint="QR ainda válido"
          href="/aparelhos/cadastrar"
          tone="text-royal"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <Card title="Precisam de atenção" i={2}>
          <p className="-mt-2 mb-4 text-[13px] text-muted">
            Sem comunicação há mais tempo. Sem sinal não significa desligado, perdido ou roubado — confirme
            com o responsável.
          </p>
          {s.attention.length === 0 ? (
            <p className="text-text-2">Nenhum aparelho sem sinal. 🎉</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {s.attention.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/aparelhos/${d.id}`}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3.5 transition-colors hover:border-sky"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">{d.displayName}</div>
                      <div className="text-[13px] text-text-2">
                        {d.holder?.name ?? 'Sem responsável'} · última comunicação {relative(d.lastSeenAt)}
                      </div>
                    </div>
                    <ConnectivityPill value={d.connectivity} lastSeenAt={d.lastSeenAt} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="flex flex-col gap-6">
          <Card title="Versões do Android" i={3}>
            <Bars total={c.total} rows={s.byAndroid.map((r) => ({ label: `Android ${r.key}`, n: r.n }))} />
          </Card>
          <Card title="Fabricantes" i={4}>
            <Bars
              total={c.total}
              rows={s.byManufacturer.map((r) => ({ label: MANUFACTURER[r.key] ?? r.key, n: r.n }))}
            />
          </Card>
        </div>
      </section>
    </>
  );
}
