// Cria a empresa fictícia de demonstração com responsáveis e ~250 aparelhos SIMULADOS.
import { createDb } from '@dw/db';
import { seedDemoTenant } from '../seed.js';

const appUrl = process.env.DATABASE_URL;
const platformUrl = process.env.PLATFORM_DATABASE_URL;
if (!appUrl || !platformUrl) {
  console.error('DATABASE_URL/PLATFORM_DATABASE_URL ausentes — rode `pnpm setup`.');
  process.exit(1);
}
const plat = createDb(platformUrl, 1);
const app = createDb(appUrl, 1);
try {
  const r = await seedDemoTenant(plat, app);
  console.log(
    r.created
      ? `Demonstração criada (empresa ${r.tenantId}): ${r.holders} responsáveis e ${r.devices} aparelhos simulados.`
      : `Demonstração já existe (empresa ${r.tenantId}). Nada a fazer.`,
  );
} finally {
  await plat.close();
  await app.close();
}
