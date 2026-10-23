'use client';

import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { type FormEvent, useEffect, useState } from 'react';
import { Alert, AuthFrame, Button, Field } from '@/components/ui';
import { api, ApiError, type Me } from '@/lib/api';
import { authClient, authErrorMessage } from '@/lib/auth-client';

type Step = 'senha' | 'app' | 'codigos' | 'chave';

/** Cadastro da verificação em duas etapas (obrigatório para administradores — ADR-0003). */
export default function ConfigurarSegurancaPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me>();
  const [step, setStep] = useState<Step>('senha');
  const [totpUri, setTotpUri] = useState('');
  const [qr, setQr] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Me>('/me')
      .then((m) => {
        if (m.user.twoFactorEnabled) router.replace('/');
        else setMe(m);
      })
      .catch((e) => e instanceof ApiError && e.status === 401 && router.replace('/entrar'));
  }, [router]);

  useEffect(() => {
    if (totpUri) void QRCode.toDataURL(totpUri, { margin: 1, width: 220 }).then(setQr);
  }, [totpUri]);

  const secret = totpUri ? (new URL(totpUri).searchParams.get('secret') ?? '') : '';

  async function confirmPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await authClient.twoFactor.enable({
      password: String(new FormData(e.currentTarget).get('password')),
    });
    setBusy(false);
    if (res.error || !res.data || !('totpURI' in res.data)) {
      return setError(res.error?.status === 400 ? 'Senha incorreta.' : authErrorMessage(res.error));
    }
    setTotpUri(res.data.totpURI);
    setCodes(res.data.backupCodes);
    setStep('app');
  }

  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await authClient.twoFactor.verifyTotp({
      code: String(new FormData(e.currentTarget).get('code')).trim(),
    });
    setBusy(false);
    if (res.error)
      return setError('Código inválido. Confira se o horário do celular está correto e tente de novo.');
    setStep('codigos');
  }

  async function addPasskey() {
    setBusy(true);
    setError(undefined);
    const res = await authClient.passkey.addPasskey({ name: 'Chave principal' });
    setBusy(false);
    if (res?.error) return setError('Não foi possível cadastrar a chave de acesso. Você pode tentar depois.');
    router.replace('/');
  }

  function download() {
    const text = `DW Solutions — códigos de recuperação\nConta: ${me?.user.email}\nCada código funciona uma única vez.\n\n${codes.join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: 'dw-solutions-codigos-de-recuperacao.txt',
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!me) return null;
  const passo = { senha: 1, app: 2, codigos: 3, chave: 4 }[step];

  return (
    <AuthFrame
      title="Proteja sua conta"
      subtitle={`Passo ${passo} de 4 · ${
        me.user.role === 'admin'
          ? 'Administradores precisam da verificação em duas etapas.'
          : 'Recomendado para todos os usuários.'
      }`}
    >
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {step === 'senha' && (
        <form onSubmit={confirmPassword} className="flex flex-col gap-4">
          <p className="text-text-2">
            Você vai usar um app autenticador no celular (Google Authenticator, Microsoft Authenticator ou
            similar) para gerar um código a cada login. Para começar, confirme sua senha.
          </p>
          <Field
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
          />
          <Button type="submit" disabled={busy}>
            Continuar
          </Button>
        </form>
      )}

      {step === 'app' && (
        <form onSubmit={verify} className="flex flex-col gap-4">
          <p className="text-text-2">Abra o app autenticador e escaneie o QR code.</p>
          <div className="flex justify-center rounded-xl border border-border bg-white p-3">
            {qr && <img src={qr} alt="QR code para cadastrar no app autenticador" width={220} height={220} />}
          </div>
          <details className="text-[13px] text-text-2">
            <summary className="cursor-pointer font-semibold text-royal">
              Não consegue escanear? Digite a chave
            </summary>
            <code
              data-testid="totp-secret"
              className="mt-2 block break-all rounded-lg bg-surface-2 p-2.5 font-mono text-[13px] text-text"
            >
              {secret.match(/.{1,4}/g)?.join(' ')}
            </code>
          </details>
          <Field
            label="Código de 6 dígitos"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
          <Button type="submit" disabled={busy}>
            Ativar verificação
          </Button>
        </form>
      )}

      {step === 'codigos' && (
        <div className="flex flex-col gap-4">
          <Alert tone="ok">Verificação em duas etapas ativada.</Alert>
          <p className="text-text-2">
            Guarde estes <strong>códigos de recuperação</strong> em local seguro. Eles permitem entrar se você
            perder o celular. Cada um funciona uma única vez e não serão mostrados de novo.
          </p>
          <ol
            data-testid="backup-codes"
            className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-3 font-mono text-[14px]"
          >
            {codes.map((c) => (
              <li key={c} className="rounded-lg bg-surface px-2.5 py-1.5 text-center">
                {c}
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={download} className="flex-1">
              Baixar .txt
            </Button>
            <Button
              variant="secondary"
              type="button"
              className="flex-1"
              onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))}
            >
              Copiar
            </Button>
          </div>
          <label className="flex items-start gap-2.5 text-[13.5px]">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="mt-1"
            />
            Guardei meus códigos de recuperação em local seguro.
          </label>
          <Button type="button" disabled={!saved} onClick={() => setStep('chave')}>
            Continuar
          </Button>
        </div>
      )}

      {step === 'chave' && (
        <div className="flex flex-col gap-4">
          <p className="text-text-2">
            Opcional: cadastre uma <strong>chave de acesso</strong> para entrar com a digital, o rosto ou o
            PIN deste dispositivo, sem digitar senha.
          </p>
          <Button type="button" onClick={addPasskey} disabled={busy}>
            Cadastrar chave de acesso
          </Button>
          <Button variant="ghost" type="button" onClick={() => router.replace('/')}>
            Agora não
          </Button>
        </div>
      )}
    </AuthFrame>
  );
}
