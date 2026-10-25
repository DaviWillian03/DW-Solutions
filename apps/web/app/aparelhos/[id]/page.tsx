'use client';

import { COMPLIANCE_LABEL, type ComplianceStatus } from '@dw/contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { AppShell, Card, PageHeader, useMe } from '@/components/app-shell';
import { DeviceCommands } from '@/components/device-commands';
import { CompliancePill, ConnectivityPill, Observed, Pill } from '@/components/status';
import { Alert, Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { dateOnly, dateTime, EVENT_LABEL, MANUFACTURER, MODE, relative, SOURCE } from '@/lib/format';
import {
  CAPABILITY_LABEL,
  CAPABILITY_STATUS,
  type DeviceDetail,
  type DeviceEvent,
  type Holder,
  type PolicySummary,
} from '@/lib/types';

export default function AparelhoPage() {
  return (
    <AppShell>
      <Aparelho />
    </AppShell>
  );
}

type Tab = 'resumo' | 'politica' | 'comandos' | 'responsavel' | 'linha' | 'capacidades';
const TABS: { id: Tab; label: string; future?: string }[] = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'politica', label: 'Política' },
  { id: 'comandos', label: 'Comandos' },
  { id: 'responsavel', label: 'Responsável' },
  { id: 'linha', label: 'Linha do tempo' },
  { id: 'capacidades', label: 'Capacidades' },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 border-b border-border py-2.5 text-[14px] last:border-0 sm:grid-cols-[180px_1fr]">
      <dt className="text-text-2">{label}</dt>
      <dd className="min-w-0 break-words font-semibold">{children}</dd>
    </div>
  );
}

function Aparelho() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const [d, setD] = useState<DeviceDetail>();
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [tab, setTab] = useState<Tab>('resumo');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    api<DeviceDetail>(`/devices/${id}`)
      .then(setD)
      .catch((e) => e instanceof ApiError && e.status === 404 && setNotFound(true));
    void api<DeviceEvent[]>(`/devices/${id}/events`)
      .then(setEvents)
      .catch(() => undefined);
  }, [id]);
  useEffect(load, [load]);

  if (notFound) {
    return (
      <Card>
        <p className="text-text-2">Aparelho não encontrado.</p>
        <Link href="/aparelhos" className="font-bold text-royal">
          Voltar para Aparelhos
        </Link>
      </Card>
    );
  }
  if (!d) return <p className="text-muted">Carregando…</p>;

  return (
    <>
      <nav aria-label="Trilha" className="text-[13px] text-muted">
        <Link href="/aparelhos" className="font-semibold text-royal">
          Aparelhos
        </Link>{' '}
        / {d.displayName}
      </nav>
      <PageHeader
        title={d.displayName}
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {MANUFACTURER[d.manufacturer]} {d.model} · Android {d.androidVersion}
            </span>
            <ConnectivityPill value={d.connectivity} lastSeenAt={d.lastSeenAt} />
            <CompliancePill status={d.compliance.status} at={d.compliance.evaluatedAt} />
            {d.lostModeSince && (
              <span title={`Desde ${dateTime(d.lostModeSince)} (relatado pelo aparelho)`}>
                <Pill tone="warn">Em modo perdido</Pill>
              </span>
            )}
            {d.enrollmentState === 'unenrolled' && <Pill tone="crit">Apagado · fora do gerenciamento</Pill>}
            <Pill tone="info">origem: {SOURCE[d.source]}</Pill>
          </div>
        }
      />

      <div
        role="tablist"
        aria-label="Seções do aparelho"
        className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1"
      >
        {TABS.map((t) =>
          t.future ? (
            <span
              key={t.id}
              aria-disabled="true"
              title={`Disponível na ${t.future}`}
              className="cursor-not-allowed rounded-[9px] px-3 py-1.5 text-[13px] font-semibold text-muted opacity-70"
            >
              {t.label}
            </span>
          ) : (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`rounded-[9px] px-3 py-1.5 text-[13px] font-semibold ${tab === t.id ? 'bg-royal text-on-royal' : 'text-text-2 hover:text-text'}`}
            >
              {t.label}
            </button>
          ),
        )}
      </div>

      {tab === 'resumo' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Identificação" i={1}>
            <dl>
              <Row label="Fabricante e modelo">
                {MANUFACTURER[d.manufacturer]} {d.model}
              </Row>
              <Row label="Número de série">{d.serialNumber ?? '—'}</Row>
              <Row label="Android">{d.androidVersion}</Row>
              <Row label="Atualização de segurança">{dateOnly(d.securityPatch)}</Row>
              <Row label="Modo de gerenciamento">{MODE[d.managementMode]}</Row>
              <Row label="Cadastrado em">{dateTime(d.enrolledAt)}</Row>
              <Row label="Referência no provedor">
                <code className="break-all text-[12.5px]">{d.providerRef ?? '—'}</code>
              </Row>
            </dl>
          </Card>
          <Card title="Comunicação e telemetria" i={2}>
            <p className="-mt-1 mb-3 text-[13px] text-muted">
              Cada valor mostra quando foi lido. Nada aqui é “ao vivo”.
            </p>
            <dl>
              <Row label="Última comunicação">
                {d.lastSeenAt ? (
                  <span title={dateTime(d.lastSeenAt)}>
                    {relative(d.lastSeenAt)}{' '}
                    <span className="text-[12px] text-muted">({dateTime(d.lastSeenAt)})</span>
                  </span>
                ) : (
                  'Nunca comunicou (estado desconhecido)'
                )}
              </Row>
              <Row label="Bateria">
                <Observed value={d.battery?.value} at={d.battery?.observedAt} suffix="%" />
              </Row>
              <Row label="Armazenamento livre">
                <Observed value={d.storageFree?.value} at={d.storageFree?.observedAt} suffix="%" />
              </Row>
              <Row label="Rede">
                <Observed
                  value={
                    d.network
                      ? { wifi: 'Wi-Fi', mobile: 'Dados móveis', none: 'Sem rede' }[d.network.value]
                      : null
                  }
                  at={d.network?.observedAt}
                />
              </Row>
            </dl>
          </Card>
        </div>
      )}

      {tab === 'politica' && <PolicyTab device={d} canEdit={me.user.role === 'admin'} onChanged={load} />}

      {tab === 'comandos' && <DeviceCommands device={d} onDeviceChanged={load} />}

      {tab === 'responsavel' && <HolderTab device={d} canEdit={me.user.role === 'admin'} onChanged={load} />}

      {tab === 'linha' && (
        <Card
          title={
            <span className="flex flex-wrap items-center gap-3">
              Linha do tempo
              {me.user.role === 'admin' && (
                <Link href={`/auditoria?targetId=${d.id}`} className="text-[13px] font-bold text-royal">
                  Ver na auditoria
                </Link>
              )}
            </span>
          }
          i={1}
        >
          {events.length === 0 ? (
            <p className="text-text-2">Sem eventos registrados.</p>
          ) : (
            <ol className="relative ml-2 border-l border-border">
              {events.map((e) => (
                <li key={e.id} className="mb-4 ml-5">
                  <span
                    className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-royal"
                    aria-hidden="true"
                  />
                  <div className="font-semibold">{EVENT_LABEL[e.type] ?? e.type}</div>
                  <div className="text-[12.5px] text-muted">
                    {dateTime(e.occurredAt)} · origem: {SOURCE[e.source] ?? e.source}
                    {typeof e.details.holderName === 'string' && ` · ${e.details.holderName}`}
                    {typeof e.details.offlineHours === 'number' &&
                      ` · ficou ${e.details.offlineHours} h sem sinal`}
                    {typeof e.details.policyName === 'string' && ` · ${e.details.policyName}`}
                    {typeof e.details.version === 'number' && ` · versão ${e.details.version}`}
                    {typeof e.details.to === 'string' &&
                      ` · ${COMPLIANCE_LABEL[e.details.to as ComplianceStatus] ?? e.details.to}`}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

      {tab === 'capacidades' && (
        <Card title="O que é possível fazer neste aparelho" i={1}>
          <p className="-mt-1 mb-4 text-[13px] text-muted">
            Classificação no Android Enterprise real. Nesta versão tudo roda no simulador; nenhuma ação chega
            a um aparelho de verdade.
          </p>
          <ul className="grid gap-2 md:grid-cols-2">
            {Object.entries(d.capabilities).map(([k, v]) => (
              <li key={k} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{CAPABILITY_LABEL[k] ?? k}</span>
                  <Pill tone={v.status === 'unsupported' ? 'crit' : v.status === 'available' ? 'ok' : 'warn'}>
                    {CAPABILITY_STATUS[v.status] ?? v.status}
                  </Pill>
                </div>
                {v.note && <p className="mt-1 text-[12.5px] text-text-2">{v.note}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function HolderTab({
  device,
  canEdit,
  onChanged,
}: {
  device: DeviceDetail;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [holders, setHolders] = useState<Holder[]>([]);
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState<string>();

  useEffect(() => {
    if (canEdit)
      void api<Holder[]>('/holders').then((h) => setHolders(h.filter((x) => x.status === 'active')));
  }, [canEdit]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(undefined);
    setOk(undefined);
    try {
      await api(`/devices/${device.id}/holder`, {
        method: 'PATCH',
        body: JSON.stringify({
          holderId: String(f.get('holderId')) || null,
          reason: String(f.get('reason')),
        }),
      });
      setOk('Responsável atualizado e registrado na auditoria.');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    }
  }

  return (
    <Card title="Responsável pelo aparelho" i={1}>
      <p className="mb-4 text-[15px]">
        {device.holder ? (
          <>
            Atualmente com <strong>{device.holder.name}</strong>.
          </>
        ) : (
          'Sem responsável (reserva ou estoque).'
        )}
      </p>
      {canEdit ? (
        <form onSubmit={submit} className="flex max-w-xl flex-col gap-3">
          {error && <Alert>{error}</Alert>}
          {ok && <Alert tone="ok">{ok}</Alert>}
          <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
            Novo responsável
            <select
              name="holderId"
              // Remonta quando as opções chegam, para o valor atual aparecer selecionado.
              key={holders.length}
              defaultValue={device.holder?.id ?? ''}
              className="rounded-xl border border-border bg-surface px-3 py-2.5 font-normal"
            >
              <option value="">Sem responsável (devolver ao estoque)</option>
              {holders.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.fullName} {h.employeeCode ? `(${h.employeeCode})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
            Motivo (fica na auditoria)
            <input
              name="reason"
              required
              minLength={3}
              maxLength={300}
              placeholder="Ex.: troca de vendedor da rota Norte"
              className="rounded-xl border border-border bg-surface px-3 py-2.5 font-normal"
            />
          </label>
          <div>
            <Button type="submit">Salvar responsável</Button>
          </div>
        </form>
      ) : (
        <p className="text-[13px] text-muted">Seu perfil (Leitura) não permite alterar o responsável.</p>
      )}
    </Card>
  );
}

function PolicyTab({
  device,
  canEdit,
  onChanged,
}: {
  device: DeviceDetail;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState<string>();
  const p = device.policy;
  const c = device.compliance;

  useEffect(() => {
    if (canEdit) void api<PolicySummary[]>('/policies').then(setPolicies);
  }, [canEdit]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(undefined);
    setOk(undefined);
    try {
      const r = await api<{ changed: number }>('/devices/policy', {
        method: 'POST',
        body: JSON.stringify({
          deviceIds: [device.id],
          policyId: String(f.get('policyId')) || null,
          reason: String(f.get('reason')),
        }),
      });
      setOk(
        r.changed
          ? 'Política definida. O aparelho aplica na próxima comunicação; até lá a conformidade fica “Desconhecido”.'
          : 'O aparelho já usa esta política.',
      );
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Conformidade" i={1}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <CompliancePill status={c.status} at={c.evaluatedAt} />
          <span className="text-[13px] text-muted">
            {c.evaluatedAt
              ? `avaliada ${relative(c.evaluatedAt)} (${dateTime(c.evaluatedAt)})`
              : 'nunca avaliada'}
          </span>
        </div>
        {c.status === 'not_applicable' && (
          <p className="text-text-2">Este aparelho não segue nenhuma política.</p>
        )}
        {c.status === 'compliant' && (
          <p className="text-text-2">O último relatório do aparelho não aponta nenhum problema.</p>
        )}
        {c.reasons.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {c.reasons.map((r, i) => (
              <li key={i} className="rounded-xl border border-border p-3">
                <div className="font-semibold">{r.message}</div>
                {r.fix && <div className="mt-0.5 text-[13px] text-text-2">Como resolver: {r.fix}</div>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Política do aparelho" i={2}>
        {p ? (
          <dl>
            <Row label="Política">
              <Link href={`/politicas/${p.id}`} className="text-royal">
                {p.name}
              </Link>
            </Row>
            <Row label="Versão desejada">
              {p.version} <span className="text-[12px] text-muted">(definida {relative(p.assignedAt)})</span>
            </Row>
            <Row label="Versão aplicada">
              {p.appliedVersion ? (
                <>
                  {p.appliedVersion}{' '}
                  <span className="text-[12px] text-muted">
                    (relatada pelo aparelho {relative(p.reportedAt)} · {dateTime(p.reportedAt)})
                  </span>
                </>
              ) : (
                <span className="text-muted">Aguardando o aparelho relatar</span>
              )}
            </Row>
          </dl>
        ) : (
          <p className="text-text-2">Sem política.</p>
        )}
        {canEdit ? (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            {error && <Alert>{error}</Alert>}
            {ok && <Alert tone="ok">{ok}</Alert>}
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
              Trocar política
              <select
                name="policyId"
                // Remonta quando as opções chegam, para o valor atual aparecer selecionado.
                key={policies.length}
                defaultValue={p?.id ?? ''}
                className="rounded-xl border border-border bg-surface px-3 py-2.5 font-normal"
              >
                <option value="">Sem política</option>
                {policies.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} (versão {x.currentVersion})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
              Motivo (fica na auditoria)
              <input
                name="reason"
                required
                minLength={3}
                maxLength={300}
                placeholder="Ex.: vendedor passou para merchandising"
                className="rounded-xl border border-border bg-surface px-3 py-2.5 font-normal"
              />
            </label>
            <div>
              <Button type="submit">Salvar política</Button>
            </div>
          </form>
        ) : (
          <p className="mt-3 text-[13px] text-muted">Seu perfil (Leitura) não permite trocar a política.</p>
        )}
      </Card>
    </div>
  );
}
