'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { Alert, AuthFrame, Button, Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

export default function ConvitePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // O token vem no fragmento (#), que nunca é enviado ao servidor. Removemos da barra de endereço.
    const t = window.location.hash.slice(1);
    setToken(/^[A-Za-z0-9_-]{43}$/.test(t) ? t : null);
    if (t) window.history.replaceState(null, '', '/convite');
    setReady(true);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password'));
    if (password.length < 12) return setError('A senha precisa ter pelo menos 12 caracteres.');
    if (password !== String(form.get('confirm'))) return setError('As senhas não conferem.');
    setBusy(true);
    setError(undefined);
    try {
      const { email } = await api<{ email: string }>('/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      const res = await authClient.signIn.email({ email, password });
      if (res.error) return router.replace('/entrar');
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'INVALID_INVITATION'
          ? 'Este convite é inválido, expirou ou já foi usado. Peça um novo ao administrador.'
          : 'Não foi possível aceitar o convite. Tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  if (!token) {
    return (
      <AuthFrame title="Convite inválido">
        <Alert>O link do convite está incompleto. Abra novamente o link recebido ou peça um novo.</Alert>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Bem-vindo(a)!" subtitle="Crie sua senha para acessar o DW Solutions.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field
          label="Nova senha"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="Use pelo menos 12 caracteres. Uma frase longa é mais segura e fácil de lembrar."
          minLength={12}
          maxLength={128}
          required
        />
        <Field label="Confirme a senha" name="confirm" type="password" autoComplete="new-password" required />
        <Button type="submit" disabled={busy}>
          {busy ? 'Criando acesso…' : 'Criar senha e entrar'}
        </Button>
      </form>
    </AuthFrame>
  );
}
