'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { AppShell, Card, PageHeader, useMe } from '@/components/app-shell';
import { MfaField } from '@/components/commands';
import { Pill } from '@/components/status';
import { Alert, Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { dateTime } from '@/lib/format';

export default function ConfiguracoesPage() {
  return (
    <AppShell>
      <Configuracoes />
    </AppShell>
  );
}

interface Settings {
  wipeEnabled: boolean;
  updatedAt: string;
}

function Configuracoes() {
  const me = useMe();
  const isAdmin = me.user.role === 'admin';
  const [s, setS] = useState<Settings>();
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState<string>();

  useEffect(() => {
    void api<Settings>('/settings').then(setS);
  }, []);

  async function save(wipeEnabled: boolean, e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setError(undefined);
    setOk(undefined);
    const mfaCode = e ? String(new FormData(e.currentTarget).get('mfaCode')) : null;
    try {
      const r = await api<Settings>('/settings', {
        method: 'PUT',
        body: JSON.stringify({ wipeEnabled, mfaCode }),
      });
      setS(r);
      setOk(
        wipeEnabled
          ? 'Apagar aparelhos foi ligado. A mudança está na auditoria.'
          : 'Apagar aparelhos foi desligado.',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    }
  }

  return (
    <>
      <PageHeader title="Configurações" subtitle={me.tenant.name} />
      <Card title="Comandos sensíveis" i={1}>
        <div className="flex flex-wrap items-center gap-3">
          <strong>Apagar aparelhos (wipe)</strong>
          {s && <Pill tone={s.wipeEnabled ? 'warn' : 'info'}>{s.wipeEnabled ? 'Ligado' : 'Desligado'}</Pill>}
          {s && <span className="text-[12.5px] text-muted">alterado em {dateTime(s.updatedAt)}</span>}
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[14px] text-text-2">
          <li>Começa desligado. Enquanto estiver desligado, ninguém consegue pedir apagamento.</li>
          <li>Ligado: 1 aparelho exige o nome do aparelho, o motivo e o código do app autenticador.</li>
          <li>Vários aparelhos de uma vez exigem a aprovação de um segundo administrador.</li>
          <li>Nesta versão o apagamento afeta só o simulador.</li>
        </ul>
        <div className="mt-4 max-w-md">
          {error && (
            <div className="mb-3">
              <Alert>{error}</Alert>
            </div>
          )}
          {ok && (
            <div className="mb-3">
              <Alert tone="ok">{ok}</Alert>
            </div>
          )}
          {!isAdmin ? (
            <p className="text-[13px] text-muted">Seu perfil (Leitura) não altera configurações.</p>
          ) : s?.wipeEnabled ? (
            <Button variant="secondary" onClick={() => void save(false)}>
              Desligar apagamento de aparelhos
            </Button>
          ) : (
            <form onSubmit={(e) => void save(true, e)} className="flex flex-col gap-3">
              <MfaField />
              <div>
                <Button type="submit">Ligar apagamento de aparelhos</Button>
              </div>
            </form>
          )}
        </div>
      </Card>
    </>
  );
}
