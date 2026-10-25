import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  APPROVAL_TTL_HOURS,
  CANCELLABLE_STATES,
  COMMAND_CAPABILITY,
  COMMAND_LABEL,
  COMMAND_TTL_HOURS,
  FULLY_MANAGED_ONLY,
  LOCATION_PROVIDER_RETENTION_HOURS,
  PENDING_STATES,
  REQUIRES_CONFIRM_NAME,
  REQUIRES_REASON,
  REQUIRES_STEP_UP,
  type BatchType,
  type CommandState,
  type CommandType,
  type DeviceManagementProvider,
} from '@dw/contracts';
import {
  and,
  authUsers,
  commandBatches,
  commandEvents,
  count,
  desc,
  deviceCommands,
  devices,
  eq,
  getTenantSettings,
  inArray,
  recordAudit,
  tenantSettings,
  transitionCommand,
  withTenant,
  type DbHandle,
  type DeviceCommand,
  type Tx,
} from '@dw/db';
import type { IncomingHttpHeaders } from 'node:http';
import type { AuthContext } from '../auth/decorators.js';
import { StepUpService } from '../auth/step-up.js';
import { PROVIDER } from '../devices/provider.js';
import { APP_DB } from '../infra/infra.module.js';
import { SIM_QUEUE, type SimQueue } from '../infra/queue.js';

const HOUR = 3_600_000;
const user = (a: AuthContext) => `user:${a.userId}`;
const same = (x: string, y: string) =>
  x.trim().toLocaleLowerCase('pt-BR') === y.trim().toLocaleLowerCase('pt-BR');

export interface CommandInput {
  type: CommandType;
  params: Record<string, unknown>;
  reason?: string | null;
  confirmName?: string | null;
  mfaCode?: string | null;
  idempotencyKey?: string | null;
}

export interface BatchInput {
  type: BatchType;
  deviceIds: string[];
  reason?: string | null;
  confirmText?: string | null;
  mfaCode?: string | null;
}

@Injectable()
export class CommandsService {
  constructor(
    @Inject(APP_DB) private readonly appDb: DbHandle,
    @Inject(PROVIDER) private readonly provider: DeviceManagementProvider,
    @Inject(SIM_QUEUE) private readonly queue: SimQueue,
    private readonly stepUp: StepUpService,
  ) {}

  // ----- apoio -----------------------------------------------------------------------------------
  private view(c: DeviceCommand, deviceName: string | null = null) {
    return {
      id: c.id,
      deviceId: c.deviceId,
      deviceName,
      batchId: c.batchId,
      type: c.type,
      params: c.params,
      reason: c.reason,
      state: c.state,
      stateDetail: c.stateDetail,
      requestedBy: c.requestedBy,
      requestedByName: c.requestedByName,
      providerRef: c.providerRef,
      sendAttempts: c.sendAttempts,
      expiresAt: c.expiresAt,
      finishedAt: c.finishedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      cancellable: CANCELLABLE_STATES.includes(c.state),
      source: this.provider.kind,
    };
  }

  private async userName(tx: Tx, a: AuthContext) {
    const [u] = await tx.select({ name: authUsers.name }).from(authUsers).where(eq(authUsers.id, a.userId));
    return u?.name ?? 'Administrador';
  }

  /** Registra a tentativa negada (em transação própria) e devolve o erro para lançar. */
  private async deny(a: AuthContext, action: string, reason: string, metadata: Record<string, unknown>) {
    await withTenant(this.appDb.db, a.tenantId, (tx) =>
      recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action,
        outcome: 'denied',
        reason,
        metadata,
        requestId: a.requestId,
        sourceIp: a.ip,
      }),
    );
  }

  private async wipeEnabled(a: AuthContext) {
    return withTenant(
      this.appDb.db,
      a.tenantId,
      async (tx) => (await getTenantSettings(tx, a.tenantId)).wipeEnabled,
    );
  }

  private assertSupported(type: CommandType) {
    const cap = this.provider.getCapabilities()[COMMAND_CAPABILITY[type]];
    if (cap.status === 'unsupported') {
      throw new UnprocessableEntityException({
        code: 'UNSUPPORTED',
        message: cap.note ?? 'Comando não suportado.',
      });
    }
  }

  private async enqueue(tenantId: string, ids: string[]) {
    for (const id of ids)
      await this.queue.add('command', { tenantId, commandId: id }, { jobId: `command-${id}` });
  }

  private async insertCommand(
    tx: Tx,
    a: AuthContext,
    v: {
      deviceId: string;
      type: CommandType;
      params: Record<string, unknown>;
      reason: string | null;
      name: string;
      state: CommandState;
      batchId?: string | null;
      idempotencyKey?: string | null;
      now: Date;
    },
  ) {
    const [c] = await tx
      .insert(deviceCommands)
      .values({
        tenantId: a.tenantId,
        deviceId: v.deviceId,
        batchId: v.batchId ?? null,
        type: v.type,
        params: v.params,
        reason: v.reason,
        state: v.state,
        requestedBy: a.userId,
        requestedByName: v.name,
        idempotencyKey: v.idempotencyKey ?? null,
        correlationId: a.requestId ?? null,
        expiresAt: new Date(v.now.getTime() + COMMAND_TTL_HOURS[v.type] * HOUR),
        createdAt: v.now,
      })
      .returning();
    // Etapas que já aconteceram na própria requisição ficam no histórico.
    await tx.insert(commandEvents).values(
      (['requested', 'validated', v.state] as CommandState[]).map((state, i) => ({
        tenantId: a.tenantId,
        commandId: c!.id,
        state,
        actor: i === 0 ? user(a) : 'system',
        occurredAt: v.now,
      })),
    );
    return c!;
  }

  // ----- um aparelho ------------------------------------------------------------------------------
  async create(a: AuthContext, deviceId: string, input: CommandInput, headers: IncomingHttpHeaders) {
    const now = new Date();
    this.assertSupported(input.type);
    const reason = input.reason?.trim() || null;
    if (REQUIRES_REASON.includes(input.type) && (!reason || reason.length < 3)) {
      throw new BadRequestException({
        code: 'REASON_REQUIRED',
        message: 'Informe o motivo (fica na auditoria).',
      });
    }

    // Idempotência: repetir o pedido com a mesma chave devolve o mesmo comando.
    if (input.idempotencyKey) {
      const [existing] = await withTenant(this.appDb.db, a.tenantId, (tx) =>
        tx.select().from(deviceCommands).where(eq(deviceCommands.idempotencyKey, input.idempotencyKey!)),
      );
      if (existing) {
        if (existing.deviceId !== deviceId || existing.type !== input.type) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Chave já usada em outro pedido.',
          });
        }
        return { ...this.view(existing), replayed: true };
      }
    }

    const [device] = await withTenant(this.appDb.db, a.tenantId, (tx) =>
      tx.select().from(devices).where(eq(devices.id, deviceId)),
    );
    if (!device) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Aparelho não encontrado.' });
    if (device.enrollmentState !== 'enrolled') {
      throw new ConflictException({
        code: 'DEVICE_NOT_MANAGED',
        message: 'Este aparelho não está mais gerenciado.',
      });
    }
    if (FULLY_MANAGED_ONLY.includes(input.type) && device.managementMode !== 'fully_managed') {
      throw new UnprocessableEntityException({
        code: 'LOCATE_DEDICATED',
        message: 'Localizar está desligado para aparelhos dedicados (decisão I-6).',
      });
    }
    if (REQUIRES_CONFIRM_NAME.includes(input.type) && !same(input.confirmName ?? '', device.displayName)) {
      throw new BadRequestException({
        code: 'CONFIRMATION_MISMATCH',
        message: 'Digite o nome do aparelho exatamente como aparece para confirmar.',
      });
    }
    if (input.type === 'wipe') {
      if (!(await this.wipeEnabled(a))) {
        await this.deny(a, 'command.request', 'apagar aparelhos está desligado nas configurações', {
          tipo: 'wipe',
          deviceId,
        });
        throw new ForbiddenException({
          code: 'WIPE_DISABLED',
          message: 'Apagar aparelhos está desligado. Um administrador pode ligar em Configurações.',
        });
      }
    }
    if (REQUIRES_STEP_UP.includes(input.type)) {
      await this.stepUp.verify(
        a,
        headers,
        input.mfaCode,
        input.type === 'wipe' ? 'apagar aparelho' : 'localizar aparelho',
      );
    }

    const created = await withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const [pending] = await tx
        .select({ id: deviceCommands.id })
        .from(deviceCommands)
        .where(
          and(
            eq(deviceCommands.deviceId, deviceId),
            eq(deviceCommands.type, input.type),
            inArray(deviceCommands.state, [...PENDING_STATES]),
          ),
        );
      if (pending) {
        throw new ConflictException({
          code: 'COMMAND_PENDING',
          message: `Já existe “${COMMAND_LABEL[input.type]}” pendente para este aparelho.`,
          commandId: pending.id,
        });
      }
      const c = await this.insertCommand(tx, a, {
        deviceId,
        type: input.type,
        params: input.params,
        reason,
        name: await this.userName(tx, a),
        state: 'queued',
        idempotencyKey: input.idempotencyKey,
        now,
      });
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action: 'command.request',
        targetType: 'device',
        targetId: deviceId,
        reason,
        metadata: {
          commandId: c.id,
          tipo: input.type,
          ...(REQUIRES_STEP_UP.includes(input.type) ? { mfa: 'refeito' } : {}),
        },
        requestId: a.requestId,
        sourceIp: a.ip,
      });
      return c;
    });
    await this.enqueue(a.tenantId, [created.id]);
    return this.view(created, device.displayName);
  }

  // ----- localização (I-5) -----------------------------------------------------------------------
  /**
   * Mostra a localização de um “Localizar aparelho” aplicado. Só para quem pediu, lida NA HORA no provedor e
   * nunca gravada no DW Solutions (nem na auditoria: só o fato de ter sido vista).
   */
  async location(a: AuthContext, commandId: string) {
    const [c] = await withTenant(this.appDb.db, a.tenantId, (tx) =>
      tx.select().from(deviceCommands).where(eq(deviceCommands.id, commandId)),
    );
    if (!c || c.type !== 'locate_device') {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Pedido de localização não encontrado.' });
    }
    if (c.requestedBy !== a.userId) {
      await this.deny(a, 'command.location_view', 'só quem pediu pode ver a localização', { commandId });
      throw new ForbiddenException({
        code: 'NOT_REQUESTER',
        message: 'Só o administrador que pediu a localização pode vê-la.',
      });
    }
    if (c.state !== 'applied_verified') {
      throw new ConflictException({
        code: 'LOCATION_NOT_READY',
        message: 'O aparelho ainda não relatou a localização.',
      });
    }
    const [device] = await withTenant(this.appDb.db, a.tenantId, (tx) =>
      tx.select({ providerRef: devices.providerRef }).from(devices).where(eq(devices.id, c.deviceId)),
    );
    const loc = await this.provider.getLocateResult({
      tenantId: a.tenantId,
      commandId: c.id,
      deviceId: c.deviceId,
      deviceProviderRef: device?.providerRef ?? null,
      sentAt: c.createdAt,
      appliedAt: c.finishedAt,
    });
    await withTenant(this.appDb.db, a.tenantId, (tx) =>
      recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action: 'command.location_view',
        outcome: loc ? 'success' : 'failure',
        targetType: 'device',
        targetId: c.deviceId,
        // Sem coordenadas: a auditoria registra só que a localização foi vista.
        metadata: { commandId: c.id, ...(loc ? {} : { motivo: 'o provedor não tem mais a localização' }) },
        requestId: a.requestId,
        sourceIp: a.ip,
      }),
    );
    if (!loc) {
      throw new ConflictException({
        code: 'LOCATION_GONE',
        message: `O provedor não tem mais esta localização (guarda por até ${LOCATION_PROVIDER_RETENTION_HOURS} h). Peça de novo se precisar.`,
      });
    }
    return {
      commandId: c.id,
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracyMeters: loc.accuracyMeters,
      observedAt: loc.observedAt,
      availableUntil: c.finishedAt
        ? new Date(c.finishedAt.getTime() + LOCATION_PROVIDER_RETENTION_HOURS * HOUR)
        : null,
      source: this.provider.kind,
    };
  }

  // ----- vários aparelhos -------------------------------------------------------------------------
  async createBatch(a: AuthContext, input: BatchInput, headers: IncomingHttpHeaders) {
    const now = new Date();
    this.assertSupported(input.type);
    const ids = [...new Set(input.deviceIds)];
    const reason = input.reason?.trim() || null;
    const wipe = input.type === 'wipe';
    if (wipe) {
      if (ids.length < 2) {
        throw new BadRequestException({
          code: 'USE_SINGLE',
          message: 'Para apagar um único aparelho, use a página do aparelho.',
        });
      }
      if (!reason || reason.length < 3) {
        throw new BadRequestException({
          code: 'REASON_REQUIRED',
          message: 'Informe o motivo (fica na auditoria).',
        });
      }
      if (input.confirmText?.trim() !== `APAGAR ${ids.length}`) {
        throw new BadRequestException({
          code: 'CONFIRMATION_MISMATCH',
          message: `Digite APAGAR ${ids.length} para confirmar.`,
        });
      }
      if (!(await this.wipeEnabled(a))) {
        await this.deny(a, 'command.batch_request', 'apagar aparelhos está desligado nas configurações', {
          tipo: 'wipe',
          aparelhos: ids.length,
        });
        throw new ForbiddenException({
          code: 'WIPE_DISABLED',
          message: 'Apagar aparelhos está desligado. Um administrador pode ligar em Configurações.',
        });
      }
      await this.stepUp.verify(a, headers, input.mfaCode, 'pedir apagamento em lote');
    }

    const result = await withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const rows = await tx
        .select({ id: devices.id, name: devices.displayName, state: devices.enrollmentState })
        .from(devices)
        .where(inArray(devices.id, ids));
      if (rows.length !== ids.length) {
        throw new NotFoundException({
          code: 'DEVICE_NOT_FOUND',
          message: 'Um ou mais aparelhos não foram encontrados.',
        });
      }
      const pending = new Set(
        (
          await tx
            .select({ deviceId: deviceCommands.deviceId })
            .from(deviceCommands)
            .where(
              and(
                inArray(deviceCommands.deviceId, ids),
                eq(deviceCommands.type, input.type),
                inArray(deviceCommands.state, [...PENDING_STATES]),
              ),
            )
        ).map((r) => r.deviceId),
      );
      const skipped: { deviceId: string; deviceName: string; reason: string }[] = [];
      const targets = rows.filter((r) => {
        if (r.state !== 'enrolled')
          skipped.push({ deviceId: r.id, deviceName: r.name, reason: 'não está gerenciado' });
        else if (pending.has(r.id))
          skipped.push({ deviceId: r.id, deviceName: r.name, reason: 'já tem este comando pendente' });
        else return true;
        return false;
      });
      if (targets.length === 0) {
        throw new ConflictException({
          code: 'NOTHING_TO_DO',
          message: 'Nenhum aparelho pode receber este comando.',
          skipped,
        });
      }
      const name = await this.userName(tx, a);
      const [batch] = await tx
        .insert(commandBatches)
        .values({
          tenantId: a.tenantId,
          type: input.type,
          reason,
          deviceCount: targets.length,
          status: wipe ? 'waiting_approval' : 'not_required',
          requestedBy: a.userId,
          requestedByName: name,
          expiresAt: wipe ? new Date(now.getTime() + APPROVAL_TTL_HOURS * HOUR) : null,
          createdAt: now,
        })
        .returning();
      const created: DeviceCommand[] = [];
      for (const t of targets) {
        created.push(
          await this.insertCommand(tx, a, {
            deviceId: t.id,
            type: input.type,
            params: {},
            reason,
            name,
            state: wipe ? 'waiting_approval' : 'queued',
            batchId: batch!.id,
            now,
          }),
        );
      }
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action: 'command.batch_request',
        targetType: 'batch',
        targetId: batch!.id,
        reason,
        metadata: { tipo: input.type, aparelhos: targets.map((t) => t.id), ignorados: skipped.length },
        requestId: a.requestId,
        sourceIp: a.ip,
      });
      return { batch: batch!, created, skipped };
    });
    if (!wipe)
      await this.enqueue(
        a.tenantId,
        result.created.map((c) => c.id),
      );
    return {
      batchId: result.batch.id,
      status: result.batch.status,
      created: result.created.length,
      skipped: result.skipped,
      expiresAt: result.batch.expiresAt,
    };
  }

  async approve(
    a: AuthContext,
    batchId: string,
    input: { mfaCode?: string | null; note?: string | null },
    headers: IncomingHttpHeaders,
  ) {
    const now = new Date();
    const b = await this.batchOr404(a, batchId);
    if (b.status !== 'waiting_approval' || (b.expiresAt && b.expiresAt <= now)) {
      throw new ConflictException({
        code: 'BATCH_NOT_PENDING',
        message: 'Este pedido não está mais aguardando aprovação.',
      });
    }
    if (b.requestedBy === a.userId) {
      await this.deny(a, 'command.batch_approve', 'quem pediu tentou aprovar o próprio pedido', { batchId });
      throw new ForbiddenException({
        code: 'SAME_REQUESTER',
        message: 'Quem pediu não pode aprovar. Outro administrador precisa aprovar.',
      });
    }
    if (b.type === 'wipe' && !(await this.wipeEnabled(a))) {
      await this.deny(a, 'command.batch_approve', 'apagar aparelhos está desligado nas configurações', {
        batchId,
      });
      throw new ForbiddenException({ code: 'WIPE_DISABLED', message: 'Apagar aparelhos está desligado.' });
    }
    await this.stepUp.verify(a, headers, input.mfaCode, 'aprovar comando em lote');
    const ids = await withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const name = await this.userName(tx, a);
      const [updated] = await tx
        .update(commandBatches)
        .set({
          status: 'approved',
          decidedBy: a.userId,
          decidedByName: name,
          decidedAt: now,
          decisionNote: input.note ?? null,
        })
        .where(and(eq(commandBatches.id, batchId), eq(commandBatches.status, 'waiting_approval')))
        .returning();
      if (!updated)
        throw new ConflictException({ code: 'BATCH_NOT_PENDING', message: 'Pedido já decidido.' });
      const cmds = await tx
        .select()
        .from(deviceCommands)
        .where(and(eq(deviceCommands.batchId, batchId), eq(deviceCommands.state, 'waiting_approval')));
      for (const c of cmds) {
        await transitionCommand(tx, c, 'queued', user(a), { at: now, detail: `Aprovado por ${name}.` });
      }
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action: 'command.batch_approve',
        targetType: 'batch',
        targetId: batchId,
        reason: input.note ?? null,
        metadata: { tipo: b.type, aparelhos: cmds.length, pedidoPor: b.requestedBy },
        requestId: a.requestId,
        sourceIp: a.ip,
      });
      return cmds.map((c) => c.id);
    });
    await this.enqueue(a.tenantId, ids);
    return { status: 'approved' as const, queued: ids.length };
  }

  async reject(a: AuthContext, batchId: string, note: string) {
    const now = new Date();
    const b = await this.batchOr404(a, batchId);
    if (b.status !== 'waiting_approval') {
      throw new ConflictException({
        code: 'BATCH_NOT_PENDING',
        message: 'Este pedido não está mais aguardando aprovação.',
      });
    }
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const name = await this.userName(tx, a);
      await tx
        .update(commandBatches)
        .set({
          status: 'rejected',
          decidedBy: a.userId,
          decidedByName: name,
          decidedAt: now,
          decisionNote: note,
        })
        .where(eq(commandBatches.id, batchId));
      const cmds = await tx
        .select()
        .from(deviceCommands)
        .where(and(eq(deviceCommands.batchId, batchId), eq(deviceCommands.state, 'waiting_approval')));
      for (const c of cmds) {
        await transitionCommand(tx, c, 'cancelled', user(a), {
          at: now,
          detail: `Recusado por ${name}: ${note}`,
        });
      }
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action: 'command.batch_reject',
        targetType: 'batch',
        targetId: batchId,
        reason: note,
        metadata: { tipo: b.type, aparelhos: cmds.length },
        requestId: a.requestId,
        sourceIp: a.ip,
      });
      return { status: 'rejected' as const, cancelled: cmds.length };
    });
  }

  private async batchOr404(a: AuthContext, batchId: string) {
    const [b] = await withTenant(this.appDb.db, a.tenantId, (tx) =>
      tx.select().from(commandBatches).where(eq(commandBatches.id, batchId)),
    );
    if (!b) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Pedido não encontrado.' });
    return b;
  }

  // ----- acompanhamento ---------------------------------------------------------------------------
  async cancel(a: AuthContext, commandId: string, reason: string) {
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const [c] = await tx
        .select()
        .from(deviceCommands)
        .where(eq(deviceCommands.id, commandId))
        .for('update');
      if (!c) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Comando não encontrado.' });
      if (!CANCELLABLE_STATES.includes(c.state)) {
        throw new ConflictException({
          code: 'NOT_CANCELLABLE',
          message: 'Não dá mais para cancelar: o aparelho já recebeu o comando ou ele já terminou.',
        });
      }
      const name = await this.userName(tx, a);
      const updated = await transitionCommand(tx, c, 'cancelled', user(a), {
        detail: `Cancelado por ${name}: ${reason}`,
      });
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action: 'command.cancel',
        targetType: 'command',
        targetId: c.id,
        reason,
        metadata: { tipo: c.type, deviceId: c.deviceId, estadoAnterior: c.state },
        requestId: a.requestId,
        sourceIp: a.ip,
      });
      return this.view(updated);
    });
  }

  async list(
    a: AuthContext,
    q: {
      state?: CommandState;
      type?: CommandType;
      deviceId?: string;
      batchId?: string;
      pending?: boolean;
      page: number;
      pageSize: number;
    },
  ) {
    const where = and(
      q.state ? eq(deviceCommands.state, q.state) : undefined,
      q.type ? eq(deviceCommands.type, q.type) : undefined,
      q.deviceId ? eq(deviceCommands.deviceId, q.deviceId) : undefined,
      q.batchId ? eq(deviceCommands.batchId, q.batchId) : undefined,
      q.pending ? inArray(deviceCommands.state, [...PENDING_STATES]) : undefined,
    );
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const [{ total }] = (await tx.select({ total: count() }).from(deviceCommands).where(where)) as [
        { total: number },
      ];
      const rows = await tx
        .select({ c: deviceCommands, deviceName: devices.displayName })
        .from(deviceCommands)
        .innerJoin(devices, eq(devices.id, deviceCommands.deviceId))
        .where(where)
        .orderBy(desc(deviceCommands.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize);
      const events = rows.length
        ? await tx
            .select()
            .from(commandEvents)
            .where(
              inArray(
                commandEvents.commandId,
                rows.map((r) => r.c.id),
              ),
            )
            .orderBy(commandEvents.occurredAt)
        : [];
      return {
        items: rows.map((r) => ({
          ...this.view(r.c, r.deviceName),
          events: events
            .filter((e) => e.commandId === r.c.id)
            .map((e) => ({ state: e.state, actor: e.actor, detail: e.detail, occurredAt: e.occurredAt })),
        })),
        total,
        page: q.page,
        pageSize: q.pageSize,
        generatedAt: new Date(),
        source: this.provider.kind,
      };
    });
  }

  async batches(
    a: AuthContext,
    status?: 'waiting_approval' | 'approved' | 'rejected' | 'expired' | 'not_required',
  ) {
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(commandBatches)
        .where(status ? eq(commandBatches.status, status) : undefined)
        .orderBy(desc(commandBatches.createdAt))
        .limit(50);
      const targets = rows.length
        ? await tx
            .select({ batchId: deviceCommands.batchId, deviceId: devices.id, name: devices.displayName })
            .from(deviceCommands)
            .innerJoin(devices, eq(devices.id, deviceCommands.deviceId))
            .where(
              inArray(
                deviceCommands.batchId,
                rows.map((r) => r.id),
              ),
            )
        : [];
      return rows.map((b) => ({
        id: b.id,
        type: b.type,
        reason: b.reason,
        status: b.status,
        deviceCount: b.deviceCount,
        devices: targets.filter((t) => t.batchId === b.id).map((t) => ({ id: t.deviceId, name: t.name })),
        requestedBy: b.requestedBy,
        requestedByName: b.requestedByName,
        decidedByName: b.decidedByName,
        decidedAt: b.decidedAt,
        decisionNote: b.decisionNote,
        expiresAt: b.expiresAt,
        createdAt: b.createdAt,
        canDecide: b.status === 'waiting_approval' && b.requestedBy !== a.userId && a.role === 'admin',
      }));
    });
  }

  // ----- configurações e simulador ----------------------------------------------------------------
  async settings(a: AuthContext) {
    const s = await withTenant(this.appDb.db, a.tenantId, (tx) => getTenantSettings(tx, a.tenantId));
    return { wipeEnabled: s.wipeEnabled, updatedAt: s.updatedAt };
  }

  async updateSettings(
    a: AuthContext,
    input: { wipeEnabled: boolean; mfaCode?: string | null },
    headers: IncomingHttpHeaders,
  ) {
    // Ligar uma ação irreversível exige refazer a verificação; desligar é sempre permitido.
    if (input.wipeEnabled)
      await this.stepUp.verify(a, headers, input.mfaCode, 'ligar apagamento de aparelhos');
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const before = await getTenantSettings(tx, a.tenantId);
      const [s] = await tx
        .update(tenantSettings)
        .set({ wipeEnabled: input.wipeEnabled, updatedBy: a.userId })
        .where(eq(tenantSettings.tenantId, a.tenantId))
        .returning();
      if (before.wipeEnabled !== input.wipeEnabled) {
        await recordAudit(tx, {
          tenantId: a.tenantId,
          actorType: 'user',
          actorId: a.userId,
          action: 'settings.update',
          metadata: { apagarAparelhos: { de: before.wipeEnabled, para: input.wipeEnabled } },
          requestId: a.requestId,
          sourceIp: a.ip,
        });
      }
      return { wipeEnabled: s!.wipeEnabled, updatedAt: s!.updatedAt };
    });
  }

  /** SIMULADOR: pede que o aparelho comunique agora (equivale a ele ligar / ficar on-line). */
  async simulateCheckIn(a: AuthContext, deviceId: string) {
    if (this.provider.kind !== 'simulator') {
      throw new BadRequestException({ code: 'SIMULATOR_ONLY', message: 'Disponível apenas no simulador.' });
    }
    const [d] = await withTenant(this.appDb.db, a.tenantId, (tx) =>
      tx
        .select({ id: devices.id, state: devices.enrollmentState })
        .from(devices)
        .where(eq(devices.id, deviceId)),
    );
    if (!d) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Aparelho não encontrado.' });
    if (d.state !== 'enrolled') {
      throw new ConflictException({
        code: 'DEVICE_NOT_MANAGED',
        message: 'Este aparelho não está mais gerenciado.',
      });
    }
    await this.queue.add('checkin', { tenantId: a.tenantId, deviceId }, { removeOnComplete: 1000 });
    return { queued: true };
  }
}
