'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Brand, Button, SimulatedBanner } from '@/components/ui';
import { api, ApiError, type Me } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

const NAV = ['Visão geral', 'Aparelhos', 'Políticas', 'Comandos', 'Auditoria'];

export default function HomePage() {
  const router = useRouter();
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

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 flex h-[68px] items-center gap-6 border-b border-border bg-surface px-6 md:px-10">
        <Brand />
        <nav aria-label="Principal" className="hidden gap-0.5 rounded-xl bg-surface-2 p-1 lg:flex">
          {NAV.map((item, i) =>
            i === 0 ? (
              <span
                key={item}
                aria-current="page"
                className="rounded-[9px] bg-royal px-3 py-1.5 text-[13px] font-semibold text-on-royal"
              >
                {item}
              </span>
            ) : (
              <span
                key={item}
                aria-disabled="true"
                title="Disponível nas próximas fases"
                className="cursor-not-allowed rounded-[9px] px-3 py-1.5 text-[13px] font-semibold text-muted"
              >
                {item}
              </span>
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
      <SimulatedBanner />
      <main className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-8 md:px-10">
        <div className="dw-rise">
          <h1 className="text-[28px] font-extrabold tracking-tight">Olá, {me.user.name.split(' ')[0]}!</h1>
          <p className="font-semibold text-text-2">{me.tenant.name}</p>
        </div>
        <section className="grid gap-4 md:grid-cols-3">
          <div
            className="dw-rise relative overflow-hidden rounded-[18px] p-6 text-white shadow-[0_12px_30px_rgba(26,79,214,.28)] md:col-span-2"
            style={{ ['--i' as string]: 1, background: 'linear-gradient(135deg,#0A1F4D 0%,#1A4FD6 100%)' }}
          >
            <div className="text-[13px] font-semibold text-[#C9DAFF]">Acesso seguro ativo</div>
            <div className="mt-1 text-[26px] font-extrabold tracking-tight">Sua conta está protegida</div>
            <p className="mt-2 max-w-xl text-[14px] text-[#DCE7FF]">
              Login com senha e verificação em duas etapas{me.user.twoFactorEnabled ? ' (ativa)' : ''}. As
              próximas etapas trazem o cadastro de aparelhos, políticas Vendas e Merchandising e comandos
              remotos — tudo em modo simulador.
            </p>
          </div>
          <div
            className="dw-rise rounded-[18px] border border-border bg-surface p-6 shadow-[var(--shadow)]"
            style={{ ['--i' as string]: 2 }}
          >
            <div className="text-[13.5px] font-bold">Próximas fases</div>
            <ul className="mt-3 flex flex-col gap-2 text-[13.5px] text-text-2">
              <li>B · Simulador e cadastro de aparelhos</li>
              <li>C · Políticas e conformidade</li>
              <li>D · Comandos remotos</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
