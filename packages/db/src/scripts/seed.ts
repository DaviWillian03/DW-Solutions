// Dados de DEMONSTRAÇÃO, todos fictícios (prompt-mestre §8). Idempotente.
import { eq } from 'drizzle-orm';
import { recordAudit } from '../audit.js';
import { createDb, withTenant } from '../client.js';
import { deviceHolders, tenants } from '../schema.js';

const DEMO = { name: 'Comercial Exemplo Ltda (fictícia)', slug: 'comercial-exemplo' };
const NOMES = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Elisa',
  'Fábio',
  'Gabriela',
  'Henrique',
  'Isabela',
  'João',
  'Larissa',
  'Marcos',
];
const SOBRENOMES = [
  'Almeida',
  'Barbosa',
  'Cardoso',
  'Duarte',
  'Esteves',
  'Ferraz',
  'Gomes',
  'Holanda',
  'Inácio',
  'Jardim',
  'Lacerda',
  'Moraes',
];

const appUrl = process.env.DATABASE_URL;
const platformUrl = process.env.PLATFORM_DATABASE_URL;
if (!appUrl || !platformUrl) {
  console.error('DATABASE_URL/PLATFORM_DATABASE_URL ausentes — rode `pnpm setup`.');
  process.exit(1);
}

const plat = createDb(platformUrl, 1);
const app = createDb(appUrl, 1);
try {
  let [tenant] = await plat.db.select().from(tenants).where(eq(tenants.slug, DEMO.slug));
  if (tenant) {
    console.log(`Empresa de demonstração já existe (${tenant.id}). Nada a fazer.`);
  } else {
    tenant = await plat.db.transaction(async (tx) => {
      const [t] = await tx.insert(tenants).values(DEMO).returning();
      await recordAudit(tx, {
        tenantId: t!.id,
        actorType: 'platform',
        actorId: 'seed',
        action: 'tenant.create',
        reason: 'dados de demonstração',
      });
      return t!;
    });
    const id = tenant.id;
    await withTenant(app.db, id, async (tx) => {
      const holders = NOMES.map((nome, i) => ({
        tenantId: id,
        fullName: `${nome} ${SOBRENOMES[i]}`,
        employeeCode: `F${String(i + 1).padStart(4, '0')}`,
        role: i % 3 === 2 ? ('merchandising' as const) : ('sales' as const),
      }));
      await tx.insert(deviceHolders).values(holders);
      await recordAudit(tx, {
        tenantId: id,
        actorType: 'system',
        actorId: 'seed',
        action: 'holder.bulk_create',
        metadata: { quantidade: holders.length, ficticio: true },
      });
    });
    console.log(
      `Empresa de demonstração criada: ${DEMO.name} (${id}) com ${NOMES.length} responsáveis fictícios.`,
    );
  }
} finally {
  await plat.close();
  await app.close();
}
