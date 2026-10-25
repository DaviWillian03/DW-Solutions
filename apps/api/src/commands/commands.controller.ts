import { Body, Controller, Get, Header, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { BATCH_TYPES, COMMAND_STATES, COMMAND_TYPES, commandParamsSchema, MAX_BATCH } from '@dw/contracts';
import { z } from 'zod';
import { CurrentAuth, Roles, type AuthContext, type AuthedRequest } from '../auth/decorators.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { CommandsService } from './commands.service.js';

const id = z.string().uuid();
const reason = z.string().trim().min(3).max(300);
const mfaCode = z.string().trim().max(10).nullish();
const common = {
  reason: reason.nullish(),
  confirmName: z.string().max(120).nullish(),
  mfaCode,
  idempotencyKey: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,80}$/)
    .nullish(),
};
const P = commandParamsSchema;
const commandBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('lock'), params: P.lock.default({}), ...common }),
  z.object({ type: z.literal('reboot'), params: P.reboot.default({}), ...common }),
  z.object({ type: z.literal('start_lost_mode'), params: P.start_lost_mode, ...common }),
  z.object({ type: z.literal('stop_lost_mode'), params: P.stop_lost_mode.default({}), ...common }),
  z.object({ type: z.literal('clear_app_data'), params: P.clear_app_data, ...common }),
  z.object({ type: z.literal('wipe'), params: P.wipe.default({}), ...common }),
  z.object({ type: z.literal('locate_device'), params: P.locate_device.default({}), ...common }),
  z.object({ type: z.literal('play_lost_sound'), params: P.play_lost_sound.default({}), ...common }),
]);
type CommandBody = z.infer<typeof commandBody>;

const batchBody = z.object({
  type: z.enum(BATCH_TYPES),
  deviceIds: z.array(z.string().uuid()).min(1).max(MAX_BATCH),
  reason: reason.nullish(),
  confirmText: z.string().max(40).nullish(),
  mfaCode,
});
const approveBody = z.object({ mfaCode, note: z.string().trim().max(300).nullish() });
const rejectBody = z.object({ note: reason });
const cancelBody = z.object({ reason });
const settingsBody = z.object({ wipeEnabled: z.boolean(), mfaCode });
const listQuery = z.object({
  state: z.enum(COMMAND_STATES).optional(),
  type: z.enum(COMMAND_TYPES).optional(),
  deviceId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  pending: z.enum(['1']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});
const batchesQuery = z.object({
  status: z.enum(['waiting_approval', 'approved', 'rejected', 'expired', 'not_required']).optional(),
});

@Controller()
export class CommandsController {
  constructor(private readonly commands: CommandsService) {}

  @Get('commands')
  list(@CurrentAuth() a: AuthContext, @Query(new ZodPipe(listQuery)) q: z.infer<typeof listQuery>) {
    return this.commands.list(a, { ...q, pending: q.pending === '1' });
  }

  @Get('devices/:id/commands')
  forDevice(@CurrentAuth() a: AuthContext, @Param('id', new ZodPipe(id)) deviceId: string) {
    return this.commands.list(a, { deviceId, page: 1, pageSize: 50 });
  }

  @Roles('admin')
  @HttpCode(202)
  @Post('devices/:id/commands')
  create(
    @CurrentAuth() a: AuthContext,
    @Req() req: AuthedRequest,
    @Param('id', new ZodPipe(id)) deviceId: string,
    @Body(new ZodPipe(commandBody)) body: CommandBody,
  ) {
    return this.commands.create(a, deviceId, body, req.headers);
  }

  @Roles('admin')
  @HttpCode(202)
  @Post('commands/batch')
  batch(
    @CurrentAuth() a: AuthContext,
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(batchBody)) body: z.infer<typeof batchBody>,
  ) {
    return this.commands.createBatch(a, body, req.headers);
  }

  @Get('commands/batches')
  batches(@CurrentAuth() a: AuthContext, @Query(new ZodPipe(batchesQuery)) q: z.infer<typeof batchesQuery>) {
    return this.commands.batches(a, q.status);
  }

  @Roles('admin')
  @HttpCode(200)
  @Post('commands/batches/:id/approve')
  approve(
    @CurrentAuth() a: AuthContext,
    @Req() req: AuthedRequest,
    @Param('id', new ZodPipe(id)) batchId: string,
    @Body(new ZodPipe(approveBody)) body: z.infer<typeof approveBody>,
  ) {
    return this.commands.approve(a, batchId, body, req.headers);
  }

  @Roles('admin')
  @HttpCode(200)
  @Post('commands/batches/:id/reject')
  reject(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ZodPipe(id)) batchId: string,
    @Body(new ZodPipe(rejectBody)) body: z.infer<typeof rejectBody>,
  ) {
    return this.commands.reject(a, batchId, body.note);
  }

  /** Localização (I-5): só quem pediu, lida na hora no provedor, nunca guardada nem em cache. */
  @Roles('admin')
  @Header('Cache-Control', 'no-store')
  @Get('commands/:id/location')
  location(@CurrentAuth() a: AuthContext, @Param('id', new ZodPipe(id)) commandId: string) {
    return this.commands.location(a, commandId);
  }

  @Roles('admin')
  @HttpCode(200)
  @Post('commands/:id/cancel')
  cancel(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ZodPipe(id)) commandId: string,
    @Body(new ZodPipe(cancelBody)) body: z.infer<typeof cancelBody>,
  ) {
    return this.commands.cancel(a, commandId, body.reason);
  }

  @Get('settings')
  settings(@CurrentAuth() a: AuthContext) {
    return this.commands.settings(a);
  }

  @Roles('admin')
  @Put('settings')
  updateSettings(
    @CurrentAuth() a: AuthContext,
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(settingsBody)) body: z.infer<typeof settingsBody>,
  ) {
    return this.commands.updateSettings(a, body, req.headers);
  }

  @Roles('admin')
  @HttpCode(202)
  @Post('devices/:id/simulate-check-in')
  simulateCheckIn(@CurrentAuth() a: AuthContext, @Param('id', new ZodPipe(id)) deviceId: string) {
    return this.commands.simulateCheckIn(a, deviceId);
  }
}
