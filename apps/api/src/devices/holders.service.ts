import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  asc,
  count,
  deviceHolders,
  devices,
  eq,
  ilike,
  or,
  recordAudit,
  withTenant,
  type DbHandle,
} from '@dw/db';
import type { AuthContext } from '../auth/decorators.js';
import { APP_DB } from '../infra/infra.module.js';

export interface HolderInput {
  fullName: string;
  employeeCode?: string | null;
  email?: string | null;
  phone?: string | null;
  role: 'sales' | 'merchandising' | 'other';
}

function isUnique(err: unknown) {
  let e = err as { code?: string; cause?: unknown } | undefined;
  while (e) {
    if (e.code === '23505') return true;
    e = e.cause as typeof e;
  }
  return false;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class HoldersService {
  constructor(@Inject(APP_DB) private readonly appDb: DbHandle) {}

  list(a: AuthContext, search?: string) {
    return withTenant(this.appDb.db, a.tenantId, (tx) =>
      tx
        .select({
          id: deviceHolders.id,
          fullName: deviceHolders.fullName,
          employeeCode: deviceHolders.employeeCode,
          role: deviceHolders.role,
          status: deviceHolders.status,
          devices: count(devices.id),
        })
        .from(deviceHolders)
        .leftJoin(devices, eq(devices.holderId, deviceHolders.id))
        .where(
          search
            ? or(
                ilike(deviceHolders.fullName, `%${escapeLike(search)}%`),
                ilike(deviceHolders.employeeCode, `%${escapeLike(search)}%`),
              )
            : undefined,
        )
        .groupBy(deviceHolders.id)
        .orderBy(asc(deviceHolders.fullName))
        .limit(500),
    );
  }

  async create(a: AuthContext, input: HolderInput) {
    try {
      return await withTenant(this.appDb.db, a.tenantId, async (tx) => {
        const [h] = await tx
          .insert(deviceHolders)
          .values({ tenantId: a.tenantId, ...input })
          .returning();
        await recordAudit(tx, {
          tenantId: a.tenantId,
          actorType: 'user',
          actorId: a.userId,
          action: 'holder.create',
          targetType: 'holder',
          targetId: h!.id,
          requestId: a.requestId,
        });
        return h!;
      });
    } catch (err) {
      if (isUnique(err))
        throw new ConflictException({ code: 'DUPLICATE_CODE', message: 'Matrícula já usada.' });
      throw err;
    }
  }

  async update(a: AuthContext, id: string, input: Partial<HolderInput> & { status?: 'active' | 'inactive' }) {
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const [h] = await tx.update(deviceHolders).set(input).where(eq(deviceHolders.id, id)).returning();
      if (!h) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Responsável não encontrado.' });
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action: input.status === 'inactive' ? 'holder.deactivate' : 'holder.update',
        targetType: 'holder',
        targetId: id,
        metadata: { campos: Object.keys(input) },
        requestId: a.requestId,
      });
      return h;
    });
  }
}
