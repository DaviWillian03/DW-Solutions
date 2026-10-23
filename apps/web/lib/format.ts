const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const dtf = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const df = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

/** “há 5 minutos”, “há 3 dias”… (sempre acompanhado do horário exato no title). */
export function relative(iso: string | Date | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return 'agora há pouco';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export const dateTime = (iso: string | Date | null | undefined) => (iso ? dtf.format(new Date(iso)) : '—');
export const dateOnly = (iso: string | null | undefined) =>
  iso ? df.format(new Date(`${iso}T12:00:00Z`)) : '—';

export const MANUFACTURER: Record<string, string> = { samsung: 'Samsung', motorola: 'Motorola' };
export const MODE: Record<string, string> = { fully_managed: 'Totalmente gerenciado', dedicated: 'Dedicado' };
export const HOLDER_ROLE: Record<string, string> = {
  sales: 'Vendas',
  merchandising: 'Merchandising',
  other: 'Outra',
};
export const SOURCE: Record<string, string> = {
  simulator: 'simulador',
  android_management_api: 'Android Management API',
};

export const EVENT_LABEL: Record<string, string> = {
  enrolled: 'Aparelho cadastrado',
  holder_assigned: 'Responsável definido',
  holder_removed: 'Responsável removido',
  went_silent: 'Ficou sem sinal por mais de 24 h',
  reconnected: 'Voltou a comunicar',
  battery_low: 'Bateria baixa informada',
};
