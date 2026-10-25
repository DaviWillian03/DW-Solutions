'use client';

import { COMMAND_LABEL, COMMAND_STATE_LABEL, type CommandState } from '@dw/contracts';
import Link from 'next/link';
import { type FormEvent, useId, useState } from 'react';
import { useMe } from '@/components/app-shell';
import { Dialog } from '@/components/dialog';
import { Pill } from '@/components/status';
import { Alert, Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { dateTime, relative } from '@/lib/format';
import type { CommandItem, CommandLocation } from '@/lib/types';

export const INPUT =
  'max-w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-[14px] font-normal text-text focus:border-royal focus:outline-none';

const TONE: Record<CommandState, 'ok' | 'crit' | 'unk' | 'warn' | 'info'> = {
  requested: 'info',
  validated: 'info',
  waiting_approval: 'warn',
  queued: 'info',
  sent_to_provider: 'info',
  provider_accepted: 'info',
  device_acknowledged: 'info',
  applied_verified: 'ok',
  failed: 'crit',
  expired: 'unk',
  cancelled: 'unk',
  unknown: 'unk',
};

export function CommandStatePill({ state }: { state: CommandState }) {
  return <Pill tone={TONE[state]}>{COMMAND_STATE_LABEL[state]}</Pill>;
}

/** Etapas na ordem: cada uma mostra quando aconteceu. “Aplicação verificada” só com relatório do aparelho. */
const STEPS: { state: CommandState; label: string }[] = [
  { state: 'requested', label: 'Solicitado' },
  { state: 'queued', label: 'Na fila' },
  { state: 'sent_to_provider', label: 'Enviado ao provedor' },
  { state: 'provider_accepted', label: 'Confirmado pelo provedor' },
  { state: 'device_acknowledged', label: 'Recebido pelo aparelho' },
  { state: 'applied_verified', label: 'Aplicação verificada' },
];
const FINAL_BAD: CommandState[] = ['failed', 'expired', 'cancelled'];

export function CommandSteps({ cmd }: { cmd: CommandItem }) {
  const at = (s: CommandState) => cmd.events.filter((e) => e.state === s).at(-1)?.occurredAt;
  const ended = FINAL_BAD.includes(cmd.state);
  const approval = cmd.events.some((e) => e.state === 'waiting_approval');
  const steps = approval
    ? [
        STEPS[0]!,
        { state: 'waiting_approval' as CommandState, label: 'Aprovado por 2º admin' },
        ...STEPS.slice(1),
      ]
    : STEPS;
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2 text-[12px]" aria-label="Etapas do comando">
      {steps.map((s, i) => {
        const when = s.state === 'waiting_approval' ? at('queued') : at(s.state);
        const done = Boolean(when);
        return (
          <li key={s.state} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true" className="h-px w-3 bg-border" />}
            <span
              title={when ? dateTime(when) : 'ainda não aconteceu'}
              className={`rounded-full px-2 py-0.5 font-semibold ${
                done ? 'bg-ice text-royal' : 'border border-dashed border-border text-muted'
              }`}
            >
              {done ? '✓ ' : ''}
              {s.label}
            </span>
          </li>
        );
      })}
      {ended && (
        <li className="flex items-center gap-1">
          <span aria-hidden="true" className="h-px w-3 bg-border" />
          <CommandStatePill state={cmd.state} />
        </li>
      )}
    </ol>
  );
}

function paramsText(cmd: CommandItem) {
  if (cmd.type === 'start_lost_mode') {
    // Pedidos antigos, de antes da troca por Localizar + Tocar som (I-1).
    const p = cmd.params as { message?: string; phone?: string };
    return `Mensagem: “${p.message ?? ''}”${p.phone ? ` · contato ${p.phone}` : ''}`;
  }
  if (cmd.type === 'clear_app_data')
    return `Apps: ${((cmd.params.packageNames as string[]) ?? []).join(', ')}`;
  return null;
}

export function CommandCard({
  cmd,
  canEdit,
  showDevice = false,
  onChanged,
}: {
  cmd: CommandItem;
  canEdit: boolean;
  showDevice?: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const reasonId = useId();

  async function cancel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    try {
      await api(`/commands/${cmd.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: String(new FormData(e.currentTarget).get('reason')) }),
      });
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cancelar.');
    }
  }

  const extra = paramsText(cmd);
  const me = useMe();
  const showLocation =
    cmd.type === 'locate_device' && cmd.state === 'applied_verified' && cmd.requestedBy === me.user.id;
  return (
    <li className="rounded-xl border border-border p-3.5" data-testid="command">
      <div className="flex flex-wrap items-center gap-2">
        <strong className={cmd.type === 'wipe' ? 'text-crit' : ''}>{COMMAND_LABEL[cmd.type]}</strong>
        {showDevice && cmd.deviceName && (
          <Link href={`/aparelhos/${cmd.deviceId}`} className="text-[13px] font-semibold text-royal">
            {cmd.deviceName}
          </Link>
        )}
        <span className="ml-auto">
          <CommandStatePill state={cmd.state} />
        </span>
      </div>
      <p className="mt-1 text-[12.5px] text-muted">
        Pedido por {cmd.requestedByName} {relative(cmd.createdAt)} · válido até {dateTime(cmd.expiresAt)}
        {cmd.reason && <> · motivo: “{cmd.reason}”</>}
      </p>
      {extra && <p className="text-[12.5px] text-text-2">{extra}</p>}
      <div className="mt-2.5">
        <CommandSteps cmd={cmd} />
      </div>
      {cmd.stateDetail && <p className="mt-2 text-[13px] text-text-2">{cmd.stateDetail}</p>}
      {showLocation && <LocationReveal commandId={cmd.id} />}
      {canEdit && cmd.cancellable && (
        <div className="mt-2">
          <Button variant="ghost" className="!px-2 !py-1" onClick={() => setOpen(true)}>
            Cancelar comando
          </Button>
        </div>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={`Cancelar “${COMMAND_LABEL[cmd.type]}”?`}>
        <form onSubmit={cancel} className="flex flex-col gap-3">
          <p className="text-[14px] text-text-2">
            Só funciona enquanto o aparelho ainda não recebeu o comando. Se ele comunicar antes, o
            cancelamento é recusado.
          </p>
          {error && <Alert>{error}</Alert>}
          <label htmlFor={reasonId} className="text-[13.5px] font-semibold">
            Motivo (fica na auditoria)
          </label>
          <input id={reasonId} name="reason" required minLength={3} maxLength={300} className={INPUT} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <Button type="submit">Cancelar comando</Button>
          </div>
        </form>
      </Dialog>
    </li>
  );
}

/** Campo do código de 6 dígitos para refazer a verificação em duas etapas. */
export function MfaField({ name = 'mfaCode' }: { name?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13.5px] font-semibold">
        Código do app autenticador
      </label>
      <input
        id={id}
        name={name}
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder="000000"
        className={`${INPUT} w-40 tracking-[0.3em]`}
      />
      <p className="text-[12px] text-muted">Por segurança, confirme de novo com o app autenticador.</p>
    </div>
  );
}

/**
 * Mostra a localização só quando quem pediu clica — lida na hora no provedor, mantida apenas na memória da
 * página e descartada ao ocultar (I-5).
 */
function LocationReveal({ commandId }: { commandId: string }) {
  const [loc, setLoc] = useState<CommandLocation | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function reveal() {
    setBusy(true);
    setError(undefined);
    try {
      setLoc(await api<CommandLocation>(`/commands/${commandId}/location`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível obter a localização.');
    } finally {
      setBusy(false);
    }
  }

  if (!loc) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <div>
          <Button variant="secondary" onClick={reveal} disabled={busy}>
            Ver localização
          </Button>
        </div>
        {error && <Alert>{error}</Alert>}
      </div>
    );
  }
  const coords = `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
  return (
    <div className="mt-2 rounded-xl bg-ice p-3 text-[13.5px] text-royal" data-testid="location">
      <p className="font-bold">
        {loc.source === 'simulator' ? 'Localização simulada' : 'Localização relatada pelo aparelho'}:{' '}
        <span className="break-all">{coords}</span>
      </p>
      <p>
        {loc.accuracyMeters != null ? `Precisão de cerca de ${loc.accuracyMeters} m · ` : ''}
        relatada {dateTime(loc.observedAt)}
        {loc.availableUntil ? ` · disponível no provedor até ${dateTime(loc.availableUntil)}` : ''}
      </p>
      <p className="mt-1 text-[12.5px] text-text-2">
        Só você vê. O DW Solutions não guarda as coordenadas; a auditoria registra apenas que foram vistas.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          className="font-bold text-royal underline"
          href={`https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}#map=17/${loc.latitude}/${loc.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir no mapa (site OpenStreetMap)
        </a>
        <Button variant="ghost" className="!px-2 !py-1" onClick={() => setLoc(null)}>
          Ocultar
        </Button>
      </div>
    </div>
  );
}
