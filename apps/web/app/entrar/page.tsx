'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Alert, AuthFrame, Button, Field } from '@/components/ui';
import { authClient, authErrorMessage } from '@/lib/auth-client';

export default function EntrarPage() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(undefined);
    const { data, error } = await authClient.signIn.email({
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    setBusy(false);
    if (error) return setError(authErrorMessage(error));
    // Com verificação em duas etapas ativa, o plugin redireciona para /verificacao.
    if (data && !('twoFactorRedirect' in data && data.twoFactorRedirect)) router.replace('/');
  }

  async function withPasskey() {
    setError(undefined);
    const res = await authClient.signIn.passkey();
    if (res?.error) return setError('Não foi possível entrar com a chave de acesso.');
    router.replace('/');
  }

  return (
    <AuthFrame title="Entrar" subtitle="Acesse o painel da sua empresa.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="E-mail" name="email" type="email" autoComplete="username webauthn" required />
        <Field label="Senha" name="password" type="password" autoComplete="current-password" required />
        <Button type="submit" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-[12px] text-muted">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="secondary" className="w-full" onClick={withPasskey} type="button">
        Entrar com chave de acesso
      </Button>
      <p className="mt-5 text-[12.5px] text-muted">
        Não tem conta? O acesso é feito por convite do administrador da sua empresa.
      </p>
    </AuthFrame>
  );
}
