'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Alert, AuthFrame, Button, Field } from '@/components/ui';
import { authClient, authErrorMessage } from '@/lib/auth-client';

export default function VerificacaoPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'totp' | 'backup'>('totp');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get('code')).trim();
    setBusy(true);
    setError(undefined);
    const res =
      mode === 'totp'
        ? await authClient.twoFactor.verifyTotp({ code })
        : await authClient.twoFactor.verifyBackupCode({ code });
    setBusy(false);
    if (res.error) {
      if (res.error.status === 401 && mode === 'totp') return setError('Código inválido ou expirado.');
      return setError(authErrorMessage(res.error));
    }
    router.replace('/');
  }

  return (
    <AuthFrame
      title="Verificação em duas etapas"
      subtitle={
        mode === 'totp'
          ? 'Digite o código de 6 dígitos do seu app autenticador.'
          : 'Digite um dos seus códigos de recuperação. Cada código funciona uma única vez.'
      }
    >
      <form key={mode} onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        {mode === 'totp' ? (
          <Field
            label="Código do app"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
          />
        ) : (
          <Field label="Código de recuperação" name="code" autoComplete="off" required autoFocus />
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Verificando…' : 'Verificar'}
        </Button>
      </form>
      <Button
        variant="ghost"
        className="mt-3 w-full"
        type="button"
        onClick={() => {
          setError(undefined);
          setMode(mode === 'totp' ? 'backup' : 'totp');
        }}
      >
        {mode === 'totp' ? 'Usar um código de recuperação' : 'Usar o app autenticador'}
      </Button>
    </AuthFrame>
  );
}
