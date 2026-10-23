import type { ReactNode } from 'react';
import { relative } from '@/lib/format';

type Tone = 'ok' | 'warn' | 'crit' | 'unk' | 'info';

const TONE: Record<Tone, string> = {
  ok: 'bg-ok-s text-ok',
  warn: 'bg-warn-s text-warn',
  crit: 'bg-crit-s text-crit',
  unk: 'bg-unk-s text-unk',
  info: 'bg-ice text-royal',
};

const ICON: Record<Tone, string> = { ok: '●', warn: '▲', crit: '■', unk: '◌', info: 'ℹ' };

/** Selo de status: sempre ícone + texto, nunca só cor (design system §1). */
export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-bold ${TONE[tone]}`}
    >
      <span aria-hidden="true" className="text-[9px]">
        {ICON[tone]}
      </span>
      {children}
    </span>
  );
}

export type Connectivity = 'online' | 'silent' | 'unknown';

/** Comunicação do aparelho. “Desconhecido” ≠ “Sem sinal” ≠ perdido/roubado. */
export function ConnectivityPill({ value, lastSeenAt }: { value: Connectivity; lastSeenAt?: string | null }) {
  const label = { online: 'Com sinal', silent: 'Sem sinal há +24 h', unknown: 'Desconhecido' }[value];
  const tone: Tone = { online: 'ok', silent: 'crit', unknown: 'unk' }[value] as Tone;
  return (
    <span
      title={
        lastSeenAt ? `Última comunicação: ${new Date(lastSeenAt).toLocaleString('pt-BR')}` : 'Nunca comunicou'
      }
    >
      <Pill tone={tone}>{label}</Pill>
    </span>
  );
}

/** Valor observado com o horário da leitura (nada aparece como “ao vivo”). */
export function Observed({
  value,
  at,
  suffix = '',
}: {
  value?: number | string | null;
  at?: string | null;
  suffix?: string;
}) {
  if (value == null || !at) return <span className="text-muted">sem leitura</span>;
  return (
    <span title={`Lido em ${new Date(at).toLocaleString('pt-BR')}`}>
      <span className="font-semibold">
        {value}
        {suffix}
      </span>{' '}
      <span className="text-[12px] text-muted">· {relative(at)}</span>
    </span>
  );
}
