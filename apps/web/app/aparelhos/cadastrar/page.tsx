'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import { type FormEvent, useEffect, useState } from 'react';
import { AppShell, Card, PageHeader, useMe } from '@/components/app-shell';
import { Pill } from '@/components/status';
import { Alert, Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { dateTime } from '@/lib/format';
import type { Enrollment, Holder, PolicySummary } from '@/lib/types';

export default function CadastrarPage() {
  return (
    <AppShell>
      <Cadastrar />
    </AppShell>
  );
}

interface Created extends Enrollment {
  qrPayload: string;
  token: string;
  warning: string | null;
}

const INPUT = 'rounded-xl border border-border bg-surface px-3 py-2.5 font-normal';

function Cadastrar() {
  const me = useMe();
  const [holders, setHolders] = useState<Holder[]>([]);
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [created, setCreated] = useState<Created>();
  const [qr, setQr] = useState('');
  const [status, setStatus] = useState<Enrollment>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<Holder[]>('/holders').then((h) => setHolders(h.filter((x) => x.status === 'active')));
    void api<PolicySummary[]>('/policies').then(setPolicies);
  }, []);

  useEffect(() => {
    if (created) void QRCode.toDataURL(created.qrPayload, { margin: 1, width: 240 }).then(setQr);
  }, [created]);

  // Acompanha o cadastro (assíncrono) até concluir ou expirar.
  useEffect(() => {
    if (!created) return;
    const t = setInterval(() => {
      void api<Enrollment>(`/enrollments/${created.id}`).then((s) => {
        setStatus(s);
        if (s.status === 'enrolled' || s.status === 'expired') clearInterval(t);
      });
    }, 1500);
    return () => clearInterval(t);
  }, [created]);

  if (me.user.role !== 'admin') {
    return (
      <Card>
        <p className="text-text-2">Seu perfil (Leitura) não permite cadastrar aparelhos.</p>
      </Card>
    );
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(undefined);
    try {
      const c = await api<Created>('/enrollments', {
        method: 'POST',
        body: JSON.stringify({
          managementMode: f.get('managementMode'),
          holderId: String(f.get('holderId')) || null,
          policyId: String(f.get('policyId')) || null,
          displayNameHint: String(f.get('displayNameHint')).trim() || null,
          durationMinutes: Number(f.get('durationMinutes')),
        }),
      });
      setCreated(c);
      setStatus(c);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar o QR.');
    } finally {
      setBusy(false);
    }
  }

  async function simulateScan() {
    if (!created) return;
    setError(undefined);
    try {
      setStatus(
        await api<Enrollment>('/enrollments/simulate-scan', {
          method: 'POST',
          body: JSON.stringify({ token: created.token }),
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha na simulação.');
    }
  }

  const st = status?.status;

  return (
    <>
      <nav aria-label="Trilha" className="text-[13px] text-muted">
        <Link href="/aparelhos" className="font-semibold text-royal">
          Aparelhos
        </Link>{' '}
        / Cadastrar
      </nav>
      <PageHeader
        title="Cadastrar aparelho"
        subtitle="Gere um QR code para colocar um smartphone da empresa sob gerenciamento."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card title="1. Dados do aparelho" i={1}>
          {error && (
            <div className="mb-3">
              <Alert>{error}</Alert>
            </div>
          )}
          <form onSubmit={create} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
              Uso do aparelho
              <select
                name="managementMode"
                className={INPUT}
                defaultValue="fully_managed"
                disabled={!!created}
              >
                <option value="fully_managed">Totalmente gerenciado (celular de vendedor/promotor)</option>
                <option value="dedicated">Dedicado (uso fixo, ex.: tablet de catálogo)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
              Responsável (opcional)
              <select name="holderId" className={INPUT} defaultValue="" disabled={!!created}>
                <option value="">Definir depois</option>
                {holders.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.fullName} {h.employeeCode ? `(${h.employeeCode})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
              Política
              <select
                name="policyId"
                className={INPUT}
                defaultValue=""
                disabled={!!created}
                key={policies.length}
              >
                <option value="">Definir depois</option>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (versão {p.currentVersion})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
              Nome do aparelho (opcional)
              <input
                name="displayNameHint"
                maxLength={80}
                placeholder="Ex.: Galaxy A25 · Vendas 120"
                className={INPUT}
                disabled={!!created}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
              Validade do QR
              <select name="durationMinutes" className={INPUT} defaultValue="60" disabled={!!created}>
                <option value="15">15 minutos</option>
                <option value="60">1 hora</option>
                <option value="480">8 horas</option>
                <option value="1440">24 horas</option>
              </select>
            </label>
            {!created && (
              <div>
                <Button type="submit" disabled={busy}>
                  Gerar QR code
                </Button>
              </div>
            )}
          </form>
          <div className="mt-5 rounded-xl bg-ice p-3.5 text-[13px] text-text-2">
            <strong className="text-text">Como funciona no Android real:</strong> o aparelho precisa estar{' '}
            <strong>redefinido de fábrica</strong> e o QR é lido na tela de boas-vindas (tocando 6 vezes
            nela). Esta tela <strong>não redefine nem altera</strong> nenhum aparelho.
          </div>
        </Card>

        <Card title="2. QR code" i={2}>
          {!created ? (
            <p className="text-text-2">Preencha os dados e gere o QR code.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div
                role="alert"
                className="rounded-xl border-2 border-dashed border-[var(--banner-line)] bg-[var(--banner-bg)] p-3 text-center text-[14px] font-extrabold text-[var(--banner-fg)]"
              >
                {created.warning}
              </div>
              <div className="relative mx-auto">
                {qr && (
                  <img
                    src={qr}
                    alt="QR code de demonstração (não provisiona aparelhos)"
                    width={240}
                    height={240}
                    className="rounded-lg border border-border bg-white p-2"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <span className="-rotate-12 rounded-md bg-[var(--banner-bg)]/90 px-2 py-1 text-[13px] font-black tracking-wide text-[var(--banner-fg)] shadow">
                    DEMONSTRAÇÃO
                  </span>
                </span>
              </div>
              <p className="text-center text-[13px] text-muted">
                Válido até {dateTime(created.expiresAt)} · o código não fica salvo no sistema.
              </p>

              <div className="flex flex-col items-center gap-2" aria-live="polite">
                {st === 'waiting_scan' && (
                  <>
                    <Pill tone="unk">Aguardando leitura do QR</Pill>
                    <Button onClick={simulateScan}>Simular leitura do QR</Button>
                    <p className="text-center text-[12.5px] text-muted">
                      Disponível só no simulador: faz de conta que um aparelho leu este QR.
                    </p>
                  </>
                )}
                {st === 'processing' && <Pill tone="info">Aguardando o aparelho concluir o cadastro…</Pill>}
                {st === 'enrolled' && status?.deviceId && (
                  <>
                    <Pill tone="ok">Aparelho cadastrado (simulado)</Pill>
                    <Link href={`/aparelhos/${status.deviceId}`} className="font-bold text-royal">
                      Abrir {status.deviceName ?? 'aparelho'}
                    </Link>
                  </>
                )}
                {st === 'expired' && <Pill tone="crit">QR expirado — gere outro</Pill>}
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
