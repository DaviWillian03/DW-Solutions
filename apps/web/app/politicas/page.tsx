'use client';

import { PASSWORD_QUALITY_LABEL } from '@dw/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell, Card, PageHeader } from '@/components/app-shell';
import { Pill } from '@/components/status';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import type { PolicySummary } from '@/lib/types';

export default function PoliticasPage() {
  return (
    <AppShell>
      <Politicas />
    </AppShell>
  );
}

function Stat({ label, n, tone }: { label: string; n: number; tone: 'ok' | 'crit' | 'unk' | 'info' }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <Pill tone={tone}>{label}</Pill>
      <span className="text-[15px] font-bold">{n}</span>
    </div>
  );
}

function Politicas() {
  const [list, setList] = useState<PolicySummary[]>();
  useEffect(() => {
    void api<PolicySummary[]>('/policies').then(setList);
  }, []);

  return (
    <>
      <PageHeader
        title="Políticas"
        subtitle="Cada aparelho segue uma política. Toda mudança vira uma nova versão e é aplicada na próxima comunicação do aparelho."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {list?.map((p, i) => (
          <Card key={p.id} i={i + 1}>
            <div className="flex flex-wrap items-start gap-3">
              <div>
                <h2 className="text-[20px] font-extrabold tracking-tight">{p.name}</h2>
                <p className="text-text-2">{p.description}</p>
              </div>
              <span className="ml-auto">
                <Pill tone="info">Versão {p.currentVersion}</Pill>
              </span>
            </div>
            <p className="mt-1 text-[12.5px] text-muted">
              Atualizada em {dateTime(p.updatedAt)} por {p.updatedByName}
            </p>

            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="mb-1 text-[13px] font-bold text-muted">
                  {p.stats.devices} aparelho{p.stats.devices === 1 ? '' : 's'}
                </h3>
                <Stat label="Conforme" n={p.stats.compliant} tone="ok" />
                <Stat label="Não conforme" n={p.stats.noncompliant} tone="crit" />
                <Stat label="Desconhecido" n={p.stats.unknown} tone="unk" />
                <p className="mt-1 text-[12.5px] text-muted">
                  {p.stats.pending} aguardando aplicar a versão atual
                </p>
              </div>
              <dl className="text-[13.5px]">
                <dt className="text-text-2">Senha de tela</dt>
                <dd className="mb-2 font-semibold">
                  {PASSWORD_QUALITY_LABEL[p.settings.screenLock.quality]}, mín.{' '}
                  {p.settings.screenLock.minLength}
                </dd>
                <dt className="text-text-2">Apps obrigatórios</dt>
                <dd className="mb-2 font-semibold">{p.settings.requiredApps.length}</dd>
                <dt className="text-text-2">Android mínimo</dt>
                <dd className="font-semibold">Android {p.settings.compliance.minAndroidVersion}</dd>
              </dl>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/politicas/${p.id}`}
                className="rounded-xl bg-royal px-4 py-2.5 text-[14px] font-bold text-on-royal"
              >
                Abrir política {p.name}
              </Link>
              {p.stats.noncompliant > 0 && (
                <Link
                  href={`/aparelhos?policy=${p.id}&compliance=noncompliant`}
                  className="rounded-xl border border-border px-4 py-2.5 text-[14px] font-bold text-royal"
                >
                  Ver não conformes
                </Link>
              )}
            </div>
          </Card>
        ))}
      </div>
      <Card title="Como isso funciona no Android real" i={3}>
        <ul className="list-disc space-y-1 pl-5 text-[14px] text-text-2">
          <li>
            Nesta versão as políticas são aplicadas ao <strong>simulador</strong>. Em aparelhos reais,
            dependem da Android Management API com elegibilidade e credenciais aprovadas (CHECKPOINT 6).
          </li>
          <li>
            “Conforme” só aparece depois que o aparelho relata a versão aplicada. Antes disso o estado é
            “Desconhecido” — nunca presumido.
          </li>
          <li>
            Nenhuma regra de não conformidade bloqueia ou apaga aparelhos automaticamente. Ações assim exigem
            um administrador (Fase D).
          </li>
        </ul>
      </Card>
    </>
  );
}
