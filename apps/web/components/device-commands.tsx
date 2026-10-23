'use client';

import { COMMAND_LABEL, FINAL_STATES, type CommandType, type PolicySettings } from '@dw/contracts';
import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, useMe } from '@/components/app-shell';
import { CommandCard, INPUT, MfaField } from '@/components/commands';
import { Dialog } from '@/components/dialog';
import { Alert, Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { CommandList, DeviceDetail } from '@/lib/types';

interface Action {
  type: CommandType;
  what: string;
  impact: string;
  real: string;
}

const ACTIONS: Action[] = [
  {
    type: 'lock',
    what: 'Bloqueia a tela agora.',
    impact: 'O responsável desbloqueia com a própria senha. Nada é apagado.',
    real: 'comando de bloqueio da Android Management API',
  },
  {
    type: 'reboot',
    what: 'Reinicia o aparelho.',
    impact: 'Apps abertos são fechados; o que não foi salvo pode se perder.',
    real: 'reinício remoto, só em aparelhos totalmente gerenciados',
  },
  {
    type: 'start_lost_mode',
    what: 'Trava o aparelho mostrando uma mensagem e um telefone de contato.',
    impact: 'O responsável não consegue usar o aparelho até o modo perdido ser desativado.',
    real: 'modo perdido em aparelhos da empresa com Android recente; localização não é coletada nesta versão',
  },
  {
    type: 'stop_lost_mode',
    what: 'Libera o aparelho do modo perdido.',
    impact: 'O aparelho volta ao uso normal.',
    real: 'desativação do modo perdido',
  },
  {
    type: 'clear_app_data',
    what: 'Apaga os dados de um app (login, cache e rascunhos).',
    impact: 'Pedidos, fotos e rascunhos que ainda não foram sincronizados podem ser perdidos.',
    real: 'limpeza de dados de app',
  },
  {
    type: 'wipe',
    what: 'Volta o aparelho às configurações de fábrica e remove do gerenciamento.',
    impact: 'IRREVERSÍVEL: tudo no aparelho é apagado, inclusive o que não foi sincronizado.',
    real: 'remoção do aparelho com apagamento',
  },
];

const NEEDS_NAME: CommandType[] = ['start_lost_mode', 'clear_app_data', 'wipe'];

export function DeviceCommands({
  device,
  onDeviceChanged,
}: {
  device: DeviceDetail;
  onDeviceChanged: () => void;
}) {
  const me = useMe();
  const isAdmin = me.user.role === 'admin';
  const [data, setData] = useState<CommandList>();
  const [open, setOpen] = useState<CommandType | null>(null);
  const [notice, setNotice] = useState<string>();
  const [wipeEnabled, setWipeEnabled] = useState<boolean>();
  const pendingBefore = useRef(0);

  const load = useCallback(async () => {
    const r = await api<CommandList>(`/devices/${device.id}/commands`);
    setData(r);
    const pending = r.items.filter((c) => !FINAL_STATES.includes(c.state)).length;
    // Um comando terminou: o estado do aparelho (ex.: modo perdido) pode ter mudado.
    if (pending < pendingBefore.current) onDeviceChanged();
    pendingBefore.current = pending;
  }, [device.id, onDeviceChanged]);

  useEffect(() => {
    void load();
    void api<{ wipeEnabled: boolean }>('/settings').then((s) => setWipeEnabled(s.wipeEnabled));
  }, [load]);

  // Acompanha enquanto houver comando a caminho do aparelho.
  const waiting = data?.items.some((c) => !FINAL_STATES.includes(c.state) && c.state !== 'waiting_approval');
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [waiting, load]);

  const managed = device.enrollmentState === 'enrolled';
  const actions = ACTIONS.filter((a) =>
    device.lostModeSince ? a.type !== 'start_lost_mode' : a.type !== 'stop_lost_mode',
  );

  async function simulateCheckIn() {
    await api(`/devices/${device.id}/simulate-check-in`, { method: 'POST' });
    setNotice('O aparelho simulado vai comunicar em instantes — acompanhe as etapas abaixo.');
    setTimeout(() => void load(), 1500);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
      <Card title="Enviar comando" i={1}>
        {!managed ? (
          <p className="text-text-2">
            Este aparelho foi apagado e não está mais gerenciado. Nenhum comando é possível.
          </p>
        ) : (
          <>
            <p className="-mt-1 mb-4 text-[13px] text-muted">
              Tudo acontece no <strong>simulador</strong>. “Confirmado pelo provedor” não significa aplicado:
              só “Aplicação verificada” indica que o aparelho relatou o resultado.
            </p>
            <ul className="grid gap-2.5 md:grid-cols-2">
              {actions.map((a) => (
                <li
                  key={a.type}
                  className={`flex flex-col gap-1.5 rounded-xl border p-3.5 ${a.type === 'wipe' ? 'border-crit/40' : 'border-border'}`}
                >
                  <strong className={a.type === 'wipe' ? 'text-crit' : ''}>{COMMAND_LABEL[a.type]}</strong>
                  <span className="text-[13px] text-text-2">{a.what}</span>
                  <span className="text-[12px] text-muted">
                    No Android real: {a.real} (a confirmar no CHECKPOINT 6).
                  </span>
                  <div className="mt-auto pt-1">
                    {isAdmin ? (
                      <Button
                        variant={a.type === 'wipe' ? 'secondary' : 'secondary'}
                        className={a.type === 'wipe' ? '!border-crit/50 !text-crit' : ''}
                        onClick={() => setOpen(a.type)}
                      >
                        {COMMAND_LABEL[a.type]}…
                      </Button>
                    ) : (
                      <span className="text-[12.5px] text-muted">Somente administradores</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {isAdmin && data?.source === 'simulator' && (
              <div className="mt-4 rounded-xl bg-surface-2 p-3.5">
                <p className="mb-2 text-[13px] text-text-2">
                  No simulador, um aparelho sem sinal só recebe comandos quando “volta”. Use para testar:
                </p>
                <Button variant="secondary" onClick={simulateCheckIn}>
                  Simular comunicação do aparelho agora
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <Card title="Comandos deste aparelho" i={2}>
        {notice && (
          <div className="mb-3">
            <Alert tone="ok">{notice}</Alert>
          </div>
        )}
        {data && data.items.length === 0 ? (
          <p className="text-text-2">Nenhum comando enviado para este aparelho.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {data?.items.map((c) => (
              <CommandCard key={c.id} cmd={c} canEdit={isAdmin} onChanged={() => void load()} />
            ))}
          </ul>
        )}
      </Card>

      {open && (
        <CommandDialog
          device={device}
          action={ACTIONS.find((a) => a.type === open)!}
          wipeEnabled={wipeEnabled ?? false}
          tenantName={me.tenant.name}
          onClose={() => setOpen(null)}
          onSent={(msg) => {
            setOpen(null);
            setNotice(msg);
            void load();
          }}
        />
      )}
    </div>
  );
}

function CommandDialog({
  device,
  action,
  wipeEnabled,
  tenantName,
  onClose,
  onSent,
}: {
  device: DeviceDetail;
  action: Action;
  wipeEnabled: boolean;
  tenantName: string;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const t = action.type;
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [apps, setApps] = useState<PolicySettings['requiredApps']>([]);
  // Uma chave por diálogo: clique duplo ou repetição não criam dois comandos.
  const key = useMemo(() => crypto.randomUUID().replace(/-/g, ''), []);

  useEffect(() => {
    if (t === 'clear_app_data' && device.policy) {
      void api<{ settings: PolicySettings }>(`/policies/${device.policy.id}`).then((p) =>
        setApps(p.settings.requiredApps),
      );
    }
  }, [t, device.policy]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => (f.get(k) ? String(f.get(k)).trim() : undefined);
    const params =
      t === 'start_lost_mode'
        ? { message: get('message'), ...(get('phone') ? { phone: get('phone') } : {}) }
        : t === 'clear_app_data'
          ? { packageNames: [get('other') || get('app')].filter(Boolean) }
          : {};
    setBusy(true);
    setError(undefined);
    try {
      await api(`/devices/${device.id}/commands`, {
        method: 'POST',
        body: JSON.stringify({
          type: t,
          params,
          reason: get('reason') ?? null,
          confirmName: get('confirmName') ?? null,
          mfaCode: get('mfaCode') ?? null,
          idempotencyKey: key,
        }),
      });
      onSent(`“${COMMAND_LABEL[t]}” enviado. Acompanhe as etapas até a aplicação verificada.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar.');
    } finally {
      setBusy(false);
    }
  }

  const danger = t === 'wipe' || t === 'clear_app_data' || t === 'start_lost_mode';
  return (
    <Dialog open onClose={onClose} title={`${COMMAND_LABEL[t]}: ${device.displayName}`} danger={t === 'wipe'}>
      {t === 'wipe' && !wipeEnabled ? (
        <div className="flex flex-col gap-3">
          <Alert tone="warn">Apagar aparelhos está desligado para a sua empresa (padrão de segurança).</Alert>
          <p className="text-[14px] text-text-2">
            Um administrador pode ligar em{' '}
            <Link href="/configuracoes" className="font-bold text-royal">
              Configurações
            </Link>
            , confirmando com o app autenticador.
          </p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <div
            className={`rounded-xl p-3 text-[14px] ${danger ? 'bg-crit-s text-crit' : 'bg-ice text-royal'}`}
          >
            <p className="font-bold">{action.what}</p>
            <p>{action.impact}</p>
            <p className="mt-1 text-[12.5px] opacity-90">
              Aparelho: {device.displayName} · responsável: {device.holder?.name ?? 'nenhum'}
            </p>
          </div>
          {t === 'start_lost_mode' && (
            <>
              <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
                Mensagem na tela do aparelho
                <textarea
                  name="message"
                  required
                  minLength={3}
                  maxLength={200}
                  rows={2}
                  defaultValue={`Este aparelho pertence à ${tenantName}. Se encontrou, por favor ligue para o número abaixo.`}
                  className={INPUT}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
                Telefone de contato (opcional)
                <input name="phone" maxLength={20} placeholder="(11) 4000-0000" className={INPUT} />
              </label>
            </>
          )}
          {t === 'clear_app_data' && (
            <>
              <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
                App
                <select name="app" className={INPUT} defaultValue="">
                  <option value="">Escolha um app da política…</option>
                  {apps.map((a) => (
                    <option key={a.packageName} value={a.packageName}>
                      {a.name} ({a.packageName})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
                Ou outro pacote
                <input name="other" maxLength={150} placeholder="com.empresa.app" className={INPUT} />
              </label>
            </>
          )}
          <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
            Motivo{' '}
            {NEEDS_NAME.includes(t) ? '(obrigatório, fica na auditoria)' : '(opcional, fica na auditoria)'}
            <input
              name="reason"
              required={NEEDS_NAME.includes(t)}
              minLength={3}
              maxLength={300}
              placeholder={
                t === 'wipe' ? 'Ex.: aparelho roubado, boletim 1234' : 'Ex.: pedido do responsável'
              }
              className={INPUT}
            />
          </label>
          {NEEDS_NAME.includes(t) && (
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
              Para confirmar, digite o nome do aparelho:{' '}
              <strong className="text-royal">{device.displayName}</strong>
              <input name="confirmName" required autoComplete="off" className={INPUT} />
            </label>
          )}
          {t === 'wipe' && <MfaField />}
          {error && <Alert>{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Voltar
            </Button>
            <Button type="submit" disabled={busy} className={t === 'wipe' ? '!bg-crit !shadow-none' : ''}>
              {COMMAND_LABEL[t]}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
