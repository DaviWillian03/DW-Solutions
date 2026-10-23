'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

/** Monograma M2 (traço contínuo) — docs/design/marca. */
export function Monogram({ size = 36 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--mono-a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--mono-b)' }} />
        </linearGradient>
      </defs>
      <path
        d="M4 10h5.5a10 10 0 0 1 0 20H4z"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 10.5l3.2 19 4.3-12 4.3 12 3.2-19"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Monogram />
      <div className="whitespace-nowrap leading-tight">
        <div className="text-[17px] font-extrabold tracking-tight">DW Solutions</div>
        <div className={`text-[11px] font-semibold text-muted ${compact ? 'hidden 2xl:block' : ''}`}>
          Gestão de aparelhos Android
        </div>
      </div>
    </div>
  );
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-bold transition-[transform,box-shadow,background] duration-150 disabled:cursor-not-allowed disabled:opacity-60';
  const styles = {
    primary: 'bg-royal text-on-royal shadow-[0_6px_16px_rgba(26,79,214,.25)] hover:-translate-y-px',
    secondary: 'border border-border bg-surface text-text hover:border-sky',
    ghost: 'text-royal hover:bg-surface-2',
  }[variant];
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13.5px] font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-desc` : undefined}
        className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[15px] text-text placeholder:text-muted focus:border-royal focus:outline-none"
        {...props}
      />
      {(hint || error) && (
        <p id={`${id}-desc`} className={`text-[12.5px] ${error ? 'text-crit' : 'text-muted'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function Alert({
  tone = 'crit',
  children,
}: {
  tone?: 'crit' | 'ok' | 'warn' | 'info';
  children: ReactNode;
}) {
  const styles = {
    crit: 'bg-crit-s text-crit',
    ok: 'bg-ok-s text-ok',
    warn: 'bg-warn-s text-warn',
    info: 'bg-ice text-royal',
  }[tone];
  return (
    <div
      role={tone === 'crit' ? 'alert' : 'status'}
      className={`rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold ${styles}`}
    >
      {children}
    </div>
  );
}

export function SimulatedBanner() {
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-[var(--banner-line)] bg-[var(--banner-bg)] px-6 py-2 text-[13px] text-[var(--banner-fg)] md:px-10"
    >
      <strong>DADOS SIMULADOS</strong>
      <span>Nenhum aparelho real é gerenciado nesta versão.</span>
    </div>
  );
}

/** Moldura das telas de acesso (entrar, convite, verificação). */
export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="dw-rise w-full max-w-[420px] rounded-[18px] border border-border bg-surface p-7 shadow-[var(--shadow)] md:p-8">
        <div className="mb-6">
          <Brand />
        </div>
        <h1 className="text-[22px] font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-text-2">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
