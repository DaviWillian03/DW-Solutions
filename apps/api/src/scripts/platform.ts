// Ferramenta de linha de comando da PLATAFORMA (ADR-0005). Usa o papel dw_platform:
// cria empresas e convida administradores, sem acesso aos dados das empresas.
import { parseArgs } from 'node:util';
import { createDb } from '@dw/db';
import { createTenantWithAdmin, inviteAdmin } from '../platform/create-tenant.js';

const USO = `Uso:
  pnpm platform criar-empresa --nome "Empresa X" --slug empresa-x --admin-nome "Fulana" --admin-email fulana@empresa.com
  pnpm platform convidar-admin --slug empresa-x --admin-nome "Fulana" --admin-email fulana@empresa.com`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    nome: { type: 'string' },
    slug: { type: 'string' },
    'admin-nome': { type: 'string' },
    'admin-email': { type: 'string' },
  },
});

const cmd = positionals[0];
const url = process.env.PLATFORM_DATABASE_URL;
const web = process.env.WEB_ORIGIN;
if (!url || !web) {
  console.error('PLATFORM_DATABASE_URL e WEB_ORIGIN são obrigatórios (rode `pnpm setup`).');
  process.exit(1);
}
const need = (k: keyof typeof values) => {
  const v = values[k];
  if (!v) {
    console.error(`Falta --${k}.\n${USO}`);
    process.exit(1);
  }
  return v;
};

const db = createDb(url, 1);
try {
  let r: { tenantId: string; inviteUrl: string; expiresAt: Date };
  if (cmd === 'criar-empresa') {
    r = await createTenantWithAdmin(db, web, {
      name: need('nome'),
      slug: need('slug'),
      adminName: need('admin-nome'),
      adminEmail: need('admin-email'),
    });
    console.log(`Empresa criada: ${r.tenantId}`);
  } else if (cmd === 'convidar-admin') {
    r = await inviteAdmin(db, web, {
      tenantSlug: need('slug'),
      adminName: need('admin-nome'),
      adminEmail: need('admin-email'),
    });
  } else {
    console.error(USO);
    process.exit(1);
  }
  console.log(
    `\nConvite do administrador (válido até ${r.expiresAt.toLocaleString('pt-BR')}):\n${r.inviteUrl}`,
  );
  console.log('\nEste link aparece só agora. Envie por um canal seguro. Ele não fica salvo em lugar nenhum.');
} catch (err) {
  console.error(`Erro: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
