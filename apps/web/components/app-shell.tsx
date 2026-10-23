'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { Brand, Button, SimulatedBanner } from '@/components/ui';
import { api, ApiError, type Me } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

const NAV: { href: string; label: string; future?: string }[] = [
  { href: '/', label: 'Visão geral' },
  { href: '/aparelhos', label: 'Aparelhos' },
  { href: '/politicas', label: 'Políticas' },
  { href: '/responsaveis', label: 'Responsáveis' },
  { href: '/usuarios', label: 'Usuários' },
  { href: '#comandos', label: 'Comandos', future: 'Fase D' },
];

const MeContext = createContext<Me | null>(null);

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error('useMe fora do AppShell');
  return me;
}

/** Moldura das telas logadas: confere a sessão, exige MFA de admin e mostra o menu no topo. */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me>();

  useEffect(() => {
    api<Me>('/me')
      .then((m) => (m.mfaRequired ? router.replace('/configurar-seguranca') : setMe(m)))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace('/entrar');
      });
  }, [router]);

  async function sair() {
    await authClient.signOut();
    router.replace('/entrar');
  }

  if (!me) return null;
  const papel = me.user.role === 'admin' ? 'Administrador' : 'Leitura';
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <MeContext.Provider value={me}>
      <div className="min-h-screen bg-bg">
        <header className="sticky top-0 z-20 flex h-[68px] items-center gap-6 border-b border-border bg-surface px-4 md:px-10">
          <Link href="/" aria-label="DW Solutions — Visão geral">
            <Brand />
          </Link>
          <nav aria-label="Principal" className="hidden gap-0.5 rounded-xl bg-surface-2 p-1 lg:flex">
            {NAV.map((item) =>
              item.future ? (
                <span
                  key={item.label}
                  aria-disabled="true"
                  title={`Disponível na ${item.future}`}
                  className="cursor-not-allowed rounded-[9px] px-3 py-1.5 text-[13px] font-semibold text-muted opacity-70"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active(item.href) ? 'page' : undefined}
                  className={`rounded-[9px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    active(item.href) ? 'bg-royal text-on-royal' : 'text-text-2 hover:text-text'
                  }`}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-[13px] font-bold">{me.user.name}</div>
              <div className="text-[11.5px] text-muted">
                {papel} · {me.tenant.name}
              </div>
            </div>
            <Button variant="secondary" onClick={sair}>
              Sair
            </Button>
          </div>
        </header>
        <nav
          aria-label="Principal (celular)"
          className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-4 py-2 lg:hidden"
        >
          {NAV.filter((i) => !i.future).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active(item.href) ? 'page' : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
                active(item.href) ? 'bg-royal text-on-royal' : 'text-text-2'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <SimulatedBanner />
        <main className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-8 md:px-10">{children}</main>
      </div>
    </MeContext.Provider>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="dw-rise flex flex-wrap items-end gap-4">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-text-2">{subtitle}</div>}
      </div>
      {actions && <div className="ml-auto flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  children,
  className = '',
  i = 0,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  i?: number;
}) {
  return (
    <section
      className={`dw-rise rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow)] md:p-6 ${className}`}
      style={{ ['--i' as string]: i }}
    >
      {title && <h2 className="mb-3 text-[16px] font-bold">{title}</h2>}
      {children}
    </section>
  );
}

export function SourceLine({ at, source }: { at: string; source: string }) {
  return (
    <p className="text-[13px] text-muted">
      Atualizado em {new Date(at).toLocaleString('pt-BR')} · origem:{' '}
      <strong>{source === 'simulator' ? 'simulador' : source}</strong>
    </p>
  );
}
