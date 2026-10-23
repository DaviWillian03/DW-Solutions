import { writeFileSync } from 'node:fs';
import { createDb, resetDatabase, runMigrations } from '@dw/db';
import { createTenantWithAdmin } from '@dw/api/platform';
import { createRandom, seedFleetForTenant } from '@dw/simulator';

export const STATE_FILE = new URL('./.state.json', import.meta.url);

/** Banco de teste limpo + empresa fictícia com convite do 1º administrador. */
export default async function setup() {
  await resetDatabase(process.env.TEST_MIGRATOR_DATABASE_URL!);
  await runMigrations(process.env.TEST_MIGRATOR_DATABASE_URL!);
  const plat = createDb(process.env.TEST_PLATFORM_DATABASE_URL!, 1);
  try {
    const email = 'ana.admin@comercial-exemplo.test';
    const r = await createTenantWithAdmin(plat, 'http://localhost:3000', {
      name: 'Comercial Exemplo Ltda (fictícia)',
      slug: 'comercial-exemplo',
      adminName: 'Ana Admin',
      adminEmail: email,
    });
    // Frota simulada da empresa de teste (120 aparelhos, 90 responsáveis fictícios).
    const app = createDb(process.env.TEST_DATABASE_URL!, 1);
    try {
      await seedFleetForTenant(app, r.tenantId, {
        devices: 120,
        holders: 90,
        rnd: createRandom(7),
        now: new Date(),
      });
    } finally {
      await app.close();
    }
    writeFileSync(
      STATE_FILE,
      JSON.stringify({ email, invitePath: new URL(r.inviteUrl).pathname + new URL(r.inviteUrl).hash }),
    );
  } finally {
    await plat.close();
  }
}
