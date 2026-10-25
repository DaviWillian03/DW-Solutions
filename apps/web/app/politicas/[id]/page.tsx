'use client';

import {
  describeUpdates,
  PASSWORD_QUALITY,
  PASSWORD_QUALITY_LABEL,
  POLICY_FIELDS,
  type PolicyChange,
  type PolicySettings,
} from '@dw/contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppShell, Card, PageHeader, useMe } from '@/components/app-shell';
import { AllClearArt, EmptyState, PolicyEmptyArt } from '@/components/illustrations';
import { CompliancePill, ConnectivityPill, Pill } from '@/components/status';
import { Alert, Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { dateTime, relative } from '@/lib/format';
import type { DeviceList, PolicyDetail, PolicyPreview } from '@/lib/types';

export default function PoliticaPage() {
  return (
    <AppShell>
      <Politica />
    </AppShell>
  );
}

type Tab = 'config' | 'aparelhos' | 'versoes' | 'editar';
const INPUT =
  'rounded-xl border border-border bg-surface px-3 py-2 text-[14px] font-normal text-text focus:border-royal focus:outline-none';

const read = (key: string, s: PolicySettings) => POLICY_FIELDS.find((f) => f.key === key)!.read(s);

/** Onde cada grupo deve cair na Android Management API — a confirmar no CHECKPOINT 6. */
const REAL_ANDROID: Record<string, string> = {
  screen: 'passwordRequirements e maximumTimeToLock',
  apps: 'applications com instalação obrigatória (Google Play gerenciado)',
  restrictions: 'advancedSecurityOverrides e factoryResetDisabled',
  updates: 'systemUpdate',
  compliance: 'Avaliada pelo DW Solutions com o inventário relatado (versão e patch de segurança)',
};

function Section({ title, real, children }: { title: string; real: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border p-4">
      <h3 className="mb-2 text-[15px] font-bold">{title}</h3>
      {children}
      <p className="mt-3 text-[12px] text-muted">No Android real: {real} (a confirmar no CHECKPOINT 6).</p>
    </section>
  );
}

function Line({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border py-2 text-[14px] last:border-0">
      <span className="text-text-2">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function SettingsView({ s }: { s: PolicySettings }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Senha e bloqueio de tela" real={REAL_ANDROID.screen!}>
        {['screenLock.quality', 'screenLock.minLength', 'screenLock.autoLockMinutes'].map((k) => (
          <Line key={k} label={POLICY_FIELDS.find((f) => f.key === k)!.label} value={read(k, s)} />
        ))}
      </Section>
      <Section title="Apps obrigatórios" real={REAL_ANDROID.apps!}>
        {s.requiredApps.length === 0 ? (
          <p className="text-text-2">Nenhum app obrigatório.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {s.requiredApps.map((a) => (
              <li key={a.packageName} className="flex flex-wrap justify-between gap-2 text-[14px]">
                <span className="font-semibold">{a.name}</span>
                <code className="text-[12.5px] text-muted">{a.packageName}</code>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Restrições" real={REAL_ANDROID.restrictions!}>
        {[
          'restrictions.blockUnknownSources',
          'restrictions.blockUsbDebugging',
          'restrictions.blockFactoryReset',
        ].map((k) => (
          <Line key={k} label={POLICY_FIELDS.find((f) => f.key === k)!.label} value={read(k, s)} />
        ))}
      </Section>
      <Section
        title="Atualizações e regras de conformidade"
        real={`${REAL_ANDROID.updates}; ${REAL_ANDROID.compliance}`}
      >
        <Line label="Atualizações do sistema" value={describeUpdates(s.systemUpdates)} />
        {['compliance.minAndroidVersion', 'compliance.maxSecurityPatchAgeDays'].map((k) => (
          <Line key={k} label={POLICY_FIELDS.find((f) => f.key === k)!.label} value={read(k, s)} />
        ))}
      </Section>
    </div>
  );
}

function ChangesTable({ changes }: { changes: PolicyChange[] }) {
  if (changes.length === 0) return <p className="text-text-2">Nenhuma diferença entre as versões.</p>;
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
        <caption className="sr-only">Diferenças entre versões</caption>
        <thead>
          <tr className="border-b border-border text-left text-[12px] font-bold text-muted">
            <th className="px-3 py-2">Configuração</th>
            <th className="px-3 py-2">Antes</th>
            <th className="px-3 py-2">Depois</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={c.key} className="border-b border-border last:border-0">
              <td className="px-3 py-2.5 font-semibold">{c.label}</td>
              <td className="px-3 py-2.5 text-text-2">
                <del className="decoration-crit/60">{c.from}</del>
              </td>
              <td className="px-3 py-2.5 font-semibold text-royal">{c.to}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Politica() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const isAdmin = me.user.role === 'admin';
  const [p, setP] = useState<PolicyDetail>();
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('config');
  const [draft, setDraft] = useState<{ settings: PolicySettings; note: string }>();

  const load = useCallback(
    () =>
      api<PolicyDetail>(`/policies/${id}`)
        .then(setP)
        .catch((e) => e instanceof ApiError && e.status === 404 && setNotFound(true)),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (notFound) {
    return (
      <Card>
        <p className="text-text-2">Política não encontrada.</p>
        <Link href="/politicas" className="font-bold text-royal">
          Voltar para Políticas
        </Link>
      </Card>
    );
  }
  if (!p) return <p className="text-muted">Carregando…</p>;

  const tabs: { id: Tab; label: string; disabled?: string }[] = [
    { id: 'config', label: 'Configuração' },
    { id: 'aparelhos', label: `Aparelhos (${p.stats.devices})` },
    { id: 'versoes', label: `Versões (${p.versions.length})` },
    {
      id: 'editar',
      label: 'Editar',
      disabled: isAdmin ? undefined : 'Somente administradores editam políticas',
    },
  ];

  return (
    <>
      <nav aria-label="Trilha" className="text-[13px] text-muted">
        <Link href="/politicas" className="font-semibold text-royal">
          Políticas
        </Link>{' '}
        / {p.name}
      </nav>
      <PageHeader
        title={`Política ${p.name}`}
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            <span>{p.description}</span>
            <Pill tone="info">Versão {p.currentVersion}</Pill>
          </div>
        }
      />
      <div
        role="tablist"
        aria-label="Seções da política"
        className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1"
      >
        {tabs.map((t) =>
          t.disabled ? (
            <span
              key={t.id}
              aria-disabled="true"
              title={t.disabled}
              className="cursor-not-allowed rounded-[9px] px-3 py-1.5 text-[13px] font-semibold text-muted opacity-70"
            >
              {t.label}
            </span>
          ) : (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                if (t.id === 'editar') setDraft({ settings: structuredClone(p.settings), note: '' });
                setTab(t.id);
              }}
              className={`rounded-[9px] px-3 py-1.5 text-[13px] font-semibold ${tab === t.id ? 'bg-royal text-on-royal' : 'text-text-2 hover:text-text'}`}
            >
              {t.label}
            </button>
          ),
        )}
      </div>

      {tab === 'config' && (
        <Card title={`Configuração da versão ${p.currentVersion}`} i={1}>
          <SettingsView s={p.settings} />
        </Card>
      )}
      {tab === 'aparelhos' && <DevicesTab policyId={p.id} total={p.stats.devices} />}
      {tab === 'versoes' && (
        <VersionsTab
          p={p}
          isAdmin={isAdmin}
          onRestore={(settings, version) => {
            setDraft({ settings, note: `Restaurada a configuração da versão ${version}` });
            setTab('editar');
          }}
        />
      )}
      {tab === 'editar' && draft && (
        <EditTab
          p={p}
          initial={draft}
          onPublished={async () => {
            await load();
            setTab('versoes');
          }}
          onReload={async () => {
            const fresh = await api<PolicyDetail>(`/policies/${id}`);
            setP(fresh);
            setDraft({ settings: structuredClone(fresh.settings), note: '' });
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Aparelhos da política
// ---------------------------------------------------------------------------
function DevicesTab({ policyId, total }: { policyId: string; total: number }) {
  const [filter, setFilter] = useState<'' | 'noncompliant' | 'unknown' | 'compliant'>('');
  const [data, setData] = useState<DeviceList>();
  useEffect(() => {
    const q = new URLSearchParams({ policy: policyId, pageSize: '50' });
    if (filter) q.set('compliance', filter);
    void api<DeviceList>(`/devices?${q.toString()}`).then(setData);
  }, [policyId, filter]);

  if (total === 0) {
    return (
      <Card i={1}>
        <EmptyState art={<PolicyEmptyArt />} title="Nenhum aparelho usa esta política ainda">
          Escolha a política na página do aparelho, na lista de Aparelhos (vários de uma vez) ou ao gerar o QR
          de cadastro.
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card i={1}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ['', 'Todos'],
            ['noncompliant', 'Não conformes'],
            ['unknown', 'Desconhecido'],
            ['compliant', 'Conformes'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            aria-pressed={filter === v}
            onClick={() => setFilter(v)}
            className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${filter === v ? 'border-royal bg-royal text-on-royal' : 'border-border text-text-2'}`}
          >
            {label}
          </button>
        ))}
        <Link href={`/aparelhos?policy=${policyId}`} className="ml-auto text-[13px] font-bold text-royal">
          Abrir na lista de Aparelhos
        </Link>
      </div>
      {data && data.items.length === 0 ? (
        filter === 'noncompliant' ? (
          <EmptyState art={<AllClearArt />} title="Nenhum aparelho fora da política">
            Todos os aparelhos que já relataram esta versão estão conformes. Quem ainda não comunicou aparece
            como “Desconhecido”.
          </EmptyState>
        ) : (
          <p className="py-8 text-center text-text-2">Nenhum aparelho neste filtro.</p>
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {data?.items.map((d) => (
            <li key={d.id}>
              <Link
                href={`/aparelhos/${d.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 hover:border-sky"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{d.displayName}</div>
                  <div className="text-[12.5px] text-text-2">
                    {d.holder?.name ?? 'Sem responsável'} ·{' '}
                    {d.policy?.appliedVersion
                      ? `relatou a versão ${d.policy.appliedVersion} ${relative(d.policy.reportedAt)}`
                      : 'ainda não relatou a política'}
                  </div>
                  {d.compliance.status === 'noncompliant' && (
                    <div className="mt-0.5 text-[12.5px] font-semibold text-crit">
                      {d.compliance.reasons.map((r) => r.message).join(' · ')}
                    </div>
                  )}
                </div>
                <ConnectivityPill value={d.connectivity} lastSeenAt={d.lastSeenAt} />
                <CompliancePill status={d.compliance.status} at={d.compliance.evaluatedAt} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data && data.total > data.items.length && (
        <p className="mt-3 text-[13px] text-muted">
          Mostrando {data.items.length} de {data.total}. Veja todos na lista de Aparelhos.
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Versões e comparação
// ---------------------------------------------------------------------------
function VersionsTab({
  p,
  isAdmin,
  onRestore,
}: {
  p: PolicyDetail;
  isAdmin: boolean;
  onRestore: (s: PolicySettings, version: number) => void;
}) {
  const [from, setFrom] = useState(Math.max(1, p.currentVersion - 1));
  const [to, setTo] = useState(p.currentVersion);
  const [changes, setChanges] = useState<PolicyChange[]>();
  useEffect(() => {
    void api<{ changes: PolicyChange[] }>(`/policies/${p.id}/diff?from=${from}&to=${to}`).then((r) =>
      setChanges(r.changes),
    );
  }, [p.id, from, to]);

  async function restore(version: number) {
    const v = await api<{ settings: PolicySettings }>(`/policies/${p.id}/versions/${version}`);
    onRestore(v.settings, version);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card title="Histórico" i={1}>
        <ol className="flex flex-col gap-2.5">
          {p.versions.map((v) => (
            <li key={v.version} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <strong>Versão {v.version}</strong>
                {v.version === p.currentVersion && <Pill tone="ok">Atual</Pill>}
                {isAdmin && v.version !== p.currentVersion && (
                  <Button variant="ghost" className="ml-auto !px-2 !py-1" onClick={() => restore(v.version)}>
                    Restaurar esta versão
                  </Button>
                )}
              </div>
              <p className="mt-1 text-[14px]">“{v.note}”</p>
              <p className="text-[12.5px] text-muted">
                {v.createdByName} · {dateTime(v.createdAt)}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[12.5px] text-muted">
          Versões nunca são apagadas. Restaurar cria uma versão nova com a configuração antiga.
        </p>
      </Card>
      <Card title="Comparar versões" i={2}>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[14px]">
          <label className="flex items-center gap-2">
            De
            <select
              aria-label="Versão inicial"
              className={INPUT}
              value={from}
              onChange={(e) => setFrom(Number(e.target.value))}
            >
              {p.versions.map((v) => (
                <option key={v.version} value={v.version}>
                  Versão {v.version}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            para
            <select
              aria-label="Versão final"
              className={INPUT}
              value={to}
              onChange={(e) => setTo(Number(e.target.value))}
            >
              {p.versions.map((v) => (
                <option key={v.version} value={v.version}>
                  Versão {v.version}
                </option>
              ))}
            </select>
          </label>
        </div>
        {changes && <ChangesTable changes={changes} />}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edição: simular impacto antes de publicar
// ---------------------------------------------------------------------------
const toTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

function EditTab({
  p,
  initial,
  onPublished,
  onReload,
}: {
  p: PolicyDetail;
  initial: { settings: PolicySettings; note: string };
  onPublished: () => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [s, setS] = useState<PolicySettings>(initial.settings);
  const [note, setNote] = useState(initial.note);
  const [preview, setPreview] = useState<{ key: string; data: PolicyPreview }>();
  const [error, setError] = useState<{ message: string; conflict?: boolean; fields?: string[] }>();
  const [busy, setBusy] = useState(false);
  const key = useMemo(() => JSON.stringify(s), [s]);
  const previewFresh = preview?.key === key;

  useEffect(() => {
    setS(initial.settings);
    setNote(initial.note);
    setPreview(undefined);
    setError(undefined);
  }, [initial]);

  const update = (fn: (draft: PolicySettings) => void) =>
    setS((cur) => {
      const next = structuredClone(cur);
      fn(next);
      return next;
    });

  function fail(e: unknown) {
    if (e instanceof ApiError) {
      const fields = (e.body?.fields as { field: string; message: string }[] | undefined)?.map(
        (f) => `${f.field}: ${f.message}`,
      );
      setError({ message: e.message, conflict: e.code === 'VERSION_CONFLICT', fields });
    } else setError({ message: 'Não foi possível concluir.' });
  }

  async function simulate() {
    setBusy(true);
    setError(undefined);
    try {
      const data = await api<PolicyPreview>(`/policies/${p.id}/preview`, {
        method: 'POST',
        body: JSON.stringify({ settings: s }),
      });
      setPreview({ key, data });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(undefined);
    try {
      await api(`/policies/${p.id}/versions`, {
        method: 'POST',
        body: JSON.stringify({ baseVersion: p.currentVersion, settings: s, note }),
      });
      await onPublished();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  const label = (k: string) => POLICY_FIELDS.find((f) => f.key === k)!.label;
  const impact = preview?.data.impact;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
      <Card title={`Editando a partir da versão ${p.currentVersion}`} i={1}>
        <div className="flex flex-col gap-5">
          <fieldset className="grid gap-3 md:grid-cols-2">
            <legend className="mb-2 text-[15px] font-bold">Senha e bloqueio de tela</legend>
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold md:col-span-2">
              {label('screenLock.quality')}
              <select
                className={INPUT}
                value={s.screenLock.quality}
                onChange={(e) =>
                  update(
                    (d) => (d.screenLock.quality = e.target.value as PolicySettings['screenLock']['quality']),
                  )
                }
              >
                {PASSWORD_QUALITY.map((q) => (
                  <option key={q} value={q}>
                    {PASSWORD_QUALITY_LABEL[q]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
              {label('screenLock.minLength')}
              <input
                type="number"
                min={4}
                max={16}
                className={INPUT}
                value={s.screenLock.minLength}
                onChange={(e) => update((d) => (d.screenLock.minLength = Number(e.target.value)))}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
              {label('screenLock.autoLockMinutes')}
              <select
                className={INPUT}
                value={s.screenLock.autoLockMinutes}
                onChange={(e) => update((d) => (d.screenLock.autoLockMinutes = Number(e.target.value)))}
              >
                {[1, 2, 5, 10, 15, 30].map((m) => (
                  <option key={m} value={m}>
                    Após {m} min sem uso
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[15px] font-bold">Apps obrigatórios</legend>
            {s.requiredApps.map((a, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[1fr_1.3fr_auto]">
                <input
                  aria-label={`Nome do app ${i + 1}`}
                  className={INPUT}
                  value={a.name}
                  placeholder="Nome exibido"
                  onChange={(e) => update((d) => (d.requiredApps[i]!.name = e.target.value))}
                />
                <input
                  aria-label={`Pacote do app ${i + 1}`}
                  className={INPUT}
                  value={a.packageName}
                  placeholder="com.empresa.app"
                  onChange={(e) => update((d) => (d.requiredApps[i]!.packageName = e.target.value.trim()))}
                />
                <Button variant="ghost" onClick={() => update((d) => d.requiredApps.splice(i, 1))}>
                  Remover
                </Button>
              </div>
            ))}
            {s.requiredApps.length < 15 && (
              <div>
                <Button
                  variant="secondary"
                  onClick={() => update((d) => d.requiredApps.push({ name: '', packageName: '' }))}
                >
                  Adicionar app
                </Button>
              </div>
            )}
            <p className="text-[12.5px] text-muted">
              No simulador os apps são fictícios. Em aparelhos reais, precisam estar no Google Play
              gerenciado.
            </p>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[15px] font-bold">Restrições</legend>
            {(
              [
                ['blockUnknownSources', 'Bloquear instalação de apps de fontes desconhecidas'],
                ['blockUsbDebugging', 'Bloquear depuração USB (opções do desenvolvedor)'],
                ['blockFactoryReset', 'Bloquear redefinição de fábrica pelo usuário'],
              ] as const
            ).map(([k, text]) => (
              <label key={k} className="flex items-center gap-2.5 text-[14px]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--royal)]"
                  checked={s.restrictions[k]}
                  onChange={(e) => update((d) => (d.restrictions[k] = e.target.checked))}
                />
                {text}
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[15px] font-bold">Atualizações do sistema</legend>
            {(
              [
                ['automatic', 'Automáticas, assim que disponíveis'],
                ['windowed', 'Somente numa janela de horário'],
                ['postpone', 'Adiar por até 30 dias'],
              ] as const
            ).map(([mode, text]) => (
              <label key={mode} className="flex items-center gap-2.5 text-[14px]">
                <input
                  type="radio"
                  name="updates"
                  className="h-4 w-4 accent-[var(--royal)]"
                  checked={s.systemUpdates.mode === mode}
                  onChange={() =>
                    update((d) => {
                      d.systemUpdates =
                        mode === 'windowed' ? { mode, startMinute: 22 * 60, endMinute: 5 * 60 } : { mode };
                    })
                  }
                />
                {text}
              </label>
            ))}
            {s.systemUpdates.mode === 'windowed' && (
              <div className="ml-6 flex flex-wrap items-center gap-2 text-[14px]">
                das
                <input
                  type="time"
                  aria-label="Início da janela"
                  className={INPUT}
                  value={toTime(s.systemUpdates.startMinute)}
                  onChange={(e) =>
                    update(
                      (d) =>
                        d.systemUpdates.mode === 'windowed' &&
                        (d.systemUpdates.startMinute = fromTime(e.target.value)),
                    )
                  }
                />
                às
                <input
                  type="time"
                  aria-label="Fim da janela"
                  className={INPUT}
                  value={toTime(s.systemUpdates.endMinute)}
                  onChange={(e) =>
                    update(
                      (d) =>
                        d.systemUpdates.mode === 'windowed' &&
                        (d.systemUpdates.endMinute = fromTime(e.target.value)),
                    )
                  }
                />
              </div>
            )}
          </fieldset>

          <fieldset className="grid gap-3 md:grid-cols-2">
            <legend className="mb-2 text-[15px] font-bold">Regras de conformidade</legend>
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
              {label('compliance.minAndroidVersion')}
              <select
                className={INPUT}
                value={s.compliance.minAndroidVersion}
                onChange={(e) => update((d) => (d.compliance.minAndroidVersion = Number(e.target.value)))}
              >
                {[12, 13, 14, 15, 16].map((v) => (
                  <option key={v} value={v}>
                    Android {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
              {label('compliance.maxSecurityPatchAgeDays')}
              <select
                className={INPUT}
                value={s.compliance.maxSecurityPatchAgeDays ?? ''}
                onChange={(e) =>
                  update(
                    (d) =>
                      (d.compliance.maxSecurityPatchAgeDays = e.target.value ? Number(e.target.value) : null),
                  )
                }
              >
                {[30, 60, 90, 120, 180, 365].map((v) => (
                  <option key={v} value={v}>
                    {v} dias
                  </option>
                ))}
                <option value="">Sem limite</option>
              </select>
            </label>
            <p className="text-[12.5px] text-muted md:col-span-2">
              Aparelho fora destas regras fica “Não conforme”, com o motivo. Nada é bloqueado ou apagado
              automaticamente.
            </p>
          </fieldset>
        </div>
      </Card>

      <div className="flex flex-col gap-6">
        <Card title="1. Simular o impacto" i={2}>
          <p className="-mt-1 mb-3 text-[13.5px] text-text-2">
            Veja o que muda e quantos aparelhos são afetados antes de publicar. É uma estimativa com o último
            inventário de cada aparelho.
          </p>
          <Button variant="secondary" onClick={simulate} disabled={busy}>
            Simular impacto
          </Button>
          {preview && !previewFresh && (
            <p className="mt-3 text-[13px] font-semibold text-warn">
              Você mudou algo depois da simulação. Simule de novo antes de publicar.
            </p>
          )}
          {preview && previewFresh && impact && (
            <div className="mt-4 flex flex-col gap-4" aria-live="polite">
              <ChangesTable changes={preview.data.changes} />
              {preview.data.changes.length > 0 && (
                <ul className="flex flex-col gap-1.5 text-[14px]">
                  <li>
                    <strong>{impact.devices}</strong> aparelho{impact.devices === 1 ? '' : 's'} recebem a
                    versão {p.currentVersion + 1} na próxima comunicação
                    {impact.silentOrUnknown > 0 && (
                      <span className="text-text-2">
                        {' '}
                        ({impact.silentOrUnknown} sem sinal ou desconhecidos só quando voltarem)
                      </span>
                    )}
                    .
                  </li>
                  <li>
                    <strong className={impact.newlyFailing ? 'text-crit' : ''}>{impact.newlyFailing}</strong>{' '}
                    passariam a ficar não conformes pelas regras de versão/patch.
                  </li>
                  {impact.resolved > 0 && (
                    <li>
                      <strong>{impact.resolved}</strong> deixariam de falhar nessas regras.
                    </li>
                  )}
                </ul>
              )}
              {impact.newlyFailingSample.length > 0 && (
                <div>
                  <h4 className="mb-1 text-[13px] font-bold text-muted">Exemplos</h4>
                  <ul className="flex flex-col gap-1 text-[13px]">
                    {impact.newlyFailingSample.map((d) => (
                      <li key={d.id}>
                        <strong>{d.displayName}</strong> — {d.reasons.map((r) => r.message).join(' · ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title={`2. Publicar a versão ${p.currentVersion + 1}`} i={3}>
          <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
            Motivo da mudança (fica no histórico e na auditoria)
            <input
              className={INPUT}
              value={note}
              required
              minLength={3}
              maxLength={300}
              placeholder="Ex.: vendedores pediram bloqueio menos frequente"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {error && (
            <div className="mt-3 flex flex-col gap-2">
              <Alert>
                {error.message}
                {error.fields && (
                  <ul className="mt-1 list-disc pl-5 font-normal">
                    {error.fields.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
              </Alert>
              {error.conflict && (
                <div>
                  <Button variant="secondary" onClick={onReload}>
                    Carregar a versão atual
                  </Button>
                </div>
              )}
            </div>
          )}
          <div className="mt-4">
            <Button onClick={publish} disabled={busy || !previewFresh || note.trim().length < 3}>
              Publicar versão {p.currentVersion + 1}
            </Button>
            {!previewFresh && (
              <p className="mt-2 text-[12.5px] text-muted">Simule o impacto para liberar a publicação.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
