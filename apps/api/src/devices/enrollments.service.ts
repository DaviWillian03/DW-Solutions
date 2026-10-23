import { createHash } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DeviceManagementProvider } from '@dw/contracts';
import {
  and,
  desc,
  deviceHolders,
  devices,
  enrollmentTokens,
  eq,
  gt,
  isNull,
  policies,
  recordAudit,
  withTenant,
  type DbHandle,
} from '@dw/db';
import { DEMO_WARNING } from '@dw/simulator';
import type { AuthContext } from '../auth/decorators.js';
import { APP_DB } from '../infra/infra.module.js';
import { SIM_QUEUE, type SimQueue } from '../infra/queue.js';
import { PROVIDER } from './provider.js';

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

type TokenRow = typeof enrollmentTokens.$inferSelect;

export function enrollmentStatus(t: TokenRow, now = new Date()) {
  if (t.usedAt) return 'enrolled' as const;
  if (t.expiresAt <= now) return 'expired' as const;
  if (t.scanRequestedAt) return 'processing' as const;
  return 'waiting_scan' as const;
}

@Injectable()
export class EnrollmentsService {
  constructor(
    @Inject(APP_DB) private readonly appDb: DbHandle,
    @Inject(PROVIDER) private readonly provider: DeviceManagementProvider,
    @Inject(SIM_QUEUE) private readonly queue: SimQueue,
  ) {}

  private view(t: TokenRow, holderName: string | null = null, policyName: string | null = null) {
    return {
      id: t.id,
      status: enrollmentStatus(t),
      demo: t.demo,
      managementMode: t.managementMode,
      holder: t.holderId ? { id: t.holderId, name: holderName } : null,
      policy: t.policyId ? { id: t.policyId, name: policyName } : null,
      displayNameHint: t.displayNameHint,
      expiresAt: t.expiresAt,
      createdAt: t.createdAt,
      deviceId: t.deviceId,
    };
  }

  async create(
    a: AuthContext,
    input: {
      managementMode: 'fully_managed' | 'dedicated';
      holderId?: string | null;
      policyId?: string | null;
      displayNameHint?: string | null;
      durationMinutes: number;
    },
  ) {
    const tok = await this.provider.createEnrollmentToken({ tenantId: a.tenantId, ...input });
    const row = await withTenant(this.appDb.db, a.tenantId, async (tx) => {
      if (input.holderId) {
        const [h] = await tx
          .select({ id: deviceHolders.id })
          .from(deviceHolders)
          .where(eq(deviceHolders.id, input.holderId));
        if (!h)
          throw new NotFoundException({ code: 'HOLDER_NOT_FOUND', message: 'Responsável não encontrado.' });
      }
      let policyName: string | null = null;
      if (input.policyId) {
        const [p] = await tx
          .select({ name: policies.name })
          .from(policies)
          .where(eq(policies.id, input.policyId));
        if (!p)
          throw new NotFoundException({ code: 'POLICY_NOT_FOUND', message: 'Política não encontrada.' });
        policyName = p.name;
      }
      const [t] = await tx
        .insert(enrollmentTokens)
        .values({
          tenantId: a.tenantId,
          tokenHash: hash(tok.token),
          demo: tok.demo,
          managementMode: input.managementMode,
          holderId: input.holderId ?? null,
          policyId: input.policyId ?? null,
          displayNameHint: input.displayNameHint ?? null,
          providerRef: tok.providerRef,
          createdBy: a.userId,
          expiresAt: tok.expiresAt,
        })
        .returning();
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action: 'enrollment.create',
        targetType: 'enrollment',
        targetId: t!.id,
        metadata: {
          demo: tok.demo,
          modo: input.managementMode,
          minutos: input.durationMinutes,
          policyId: input.policyId ?? null,
        },
        requestId: a.requestId,
      });
      return { t: t!, policyName };
    });
    // O token aparece SÓ nesta resposta (dentro do QR); o banco guarda apenas o hash.
    return {
      ...this.view(row.t, null, row.policyName),
      qrPayload: tok.qrPayload,
      token: tok.token,
      warning: tok.demo ? DEMO_WARNING : null,
    };
  }

  list(a: AuthContext) {
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const rows = await tx
        .select({ t: enrollmentTokens, holderName: deviceHolders.fullName, policyName: policies.name })
        .from(enrollmentTokens)
        .leftJoin(deviceHolders, eq(deviceHolders.id, enrollmentTokens.holderId))
        .leftJoin(policies, eq(policies.id, enrollmentTokens.policyId))
        .orderBy(desc(enrollmentTokens.createdAt))
        .limit(50);
      return rows.map((r) => this.view(r.t, r.holderName, r.policyName));
    });
  }

  get(a: AuthContext, id: string) {
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const [r] = await tx
        .select({
          t: enrollmentTokens,
          holderName: deviceHolders.fullName,
          deviceName: devices.displayName,
          policyName: policies.name,
        })
        .from(enrollmentTokens)
        .leftJoin(deviceHolders, eq(deviceHolders.id, enrollmentTokens.holderId))
        .leftJoin(policies, eq(policies.id, enrollmentTokens.policyId))
        .leftJoin(devices, eq(devices.id, enrollmentTokens.deviceId))
        .where(eq(enrollmentTokens.id, id));
      if (!r) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cadastro não encontrado.' });
      return { ...this.view(r.t, r.holderName, r.policyName), deviceName: r.deviceName };
    });
  }

  /**
   * SIMULADOR: faz de conta que um aparelho leu o QR. Marca a leitura e enfileira o cadastro, que o
   * worker conclui de forma assíncrona (como acontece com aparelhos reais).
   */
  async simulateScan(a: AuthContext, token: string) {
    if (this.provider.kind !== 'simulator') {
      throw new BadRequestException({ code: 'SIMULATOR_ONLY', message: 'Disponível apenas no simulador.' });
    }
    const now = new Date();
    const t = await withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const [row] = await tx
        .update(enrollmentTokens)
        .set({ scanRequestedAt: now })
        .where(
          and(
            eq(enrollmentTokens.tokenHash, hash(token)),
            isNull(enrollmentTokens.scanRequestedAt),
            isNull(enrollmentTokens.usedAt),
            gt(enrollmentTokens.expiresAt, now),
          ),
        )
        .returning();
      if (!row) return null;
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action: 'enrollment.simulated_scan',
        targetType: 'enrollment',
        targetId: row.id,
        requestId: a.requestId,
      });
      return row;
    });
    if (!t) {
      throw new BadRequestException({
        code: 'INVALID_TOKEN',
        message: 'QR inválido, expirado ou já utilizado.',
      });
    }
    await this.queue.add('enroll', { tenantId: a.tenantId, tokenId: t.id }, { jobId: `enroll-${t.id}` });
    return this.view(t);
  }
}
