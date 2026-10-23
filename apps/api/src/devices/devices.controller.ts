import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentAuth, Roles, type AuthContext } from '../auth/decorators.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { DevicesService } from './devices.service.js';
import { EnrollmentsService } from './enrollments.service.js';
import { HoldersService } from './holders.service.js';

const id = z.string().uuid();

const listQuery = z.object({
  search: z.string().trim().max(80).optional(),
  connectivity: z.enum(['online', 'silent', 'unknown']).optional(),
  manufacturer: z.enum(['samsung', 'motorola']).optional(),
  android: z.coerce.number().int().min(10).max(20).optional(),
  holder: z.enum(['assigned', 'unassigned']).optional(),
  sort: z.enum(['name', 'lastSeen']).default('name'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});

const holderBody = z.object({
  holderId: z.string().uuid().nullable(),
  reason: z.string().trim().min(3).max(300),
});

const renameBody = z.object({ displayName: z.string().trim().min(2).max(80) });

const holderInput = z.object({
  fullName: z.string().trim().min(2).max(120),
  employeeCode: z.string().trim().max(30).nullish(),
  email: z.string().trim().toLowerCase().email().max(254).nullish(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9 ()+-]{8,20}$/, 'telefone inválido')
    .nullish(),
  role: z.enum(['sales', 'merchandising', 'other']),
});

const holderUpdate = holderInput.partial().extend({ status: z.enum(['active', 'inactive']).optional() });

const enrollBody = z.object({
  managementMode: z.enum(['fully_managed', 'dedicated']).default('fully_managed'),
  holderId: z.string().uuid().nullish(),
  displayNameHint: z.string().trim().min(2).max(80).nullish(),
  durationMinutes: z.coerce.number().int().min(15).max(1440).default(60),
});

const scanBody = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{32}$/, 'token inválido') });

@Controller()
export class DevicesController {
  constructor(
    private readonly devices: DevicesService,
    private readonly holders: HoldersService,
    private readonly enrollments: EnrollmentsService,
  ) {}

  // ----- aparelhos -----
  @Get('devices')
  list(@CurrentAuth() a: AuthContext, @Query(new ZodPipe(listQuery)) q: z.infer<typeof listQuery>) {
    return this.devices.list(a, q);
  }

  @Get('devices/summary')
  summary(@CurrentAuth() a: AuthContext) {
    return this.devices.summary(a);
  }

  @Get('devices/:id')
  get(@CurrentAuth() a: AuthContext, @Param('id', new ZodPipe(id)) deviceId: string) {
    return this.devices.get(a, deviceId);
  }

  @Get('devices/:id/events')
  events(@CurrentAuth() a: AuthContext, @Param('id', new ZodPipe(id)) deviceId: string) {
    return this.devices.events(a, deviceId);
  }

  @Roles('admin')
  @Patch('devices/:id/holder')
  setHolder(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ZodPipe(id)) deviceId: string,
    @Body(new ZodPipe(holderBody)) body: z.infer<typeof holderBody>,
  ) {
    return this.devices.setHolder(a, deviceId, body.holderId, body.reason);
  }

  @Roles('admin')
  @Patch('devices/:id')
  rename(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ZodPipe(id)) deviceId: string,
    @Body(new ZodPipe(renameBody)) body: z.infer<typeof renameBody>,
  ) {
    return this.devices.rename(a, deviceId, body.displayName);
  }

  // ----- responsáveis -----
  @Get('holders')
  listHolders(@CurrentAuth() a: AuthContext, @Query('search') search?: string) {
    return this.holders.list(a, search?.trim().slice(0, 80) || undefined);
  }

  @Roles('admin')
  @Post('holders')
  createHolder(
    @CurrentAuth() a: AuthContext,
    @Body(new ZodPipe(holderInput)) body: z.infer<typeof holderInput>,
  ) {
    return this.holders.create(a, body);
  }

  @Roles('admin')
  @Patch('holders/:id')
  updateHolder(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ZodPipe(id)) holderId: string,
    @Body(new ZodPipe(holderUpdate)) body: z.infer<typeof holderUpdate>,
  ) {
    return this.holders.update(a, holderId, body);
  }

  // ----- cadastro (QR) -----
  @Get('enrollments')
  listEnrollments(@CurrentAuth() a: AuthContext) {
    return this.enrollments.list(a);
  }

  @Get('enrollments/:id')
  getEnrollment(@CurrentAuth() a: AuthContext, @Param('id', new ZodPipe(id)) enrollmentId: string) {
    return this.enrollments.get(a, enrollmentId);
  }

  @Roles('admin')
  @Post('enrollments')
  createEnrollment(
    @CurrentAuth() a: AuthContext,
    @Body(new ZodPipe(enrollBody)) body: z.infer<typeof enrollBody>,
  ) {
    return this.enrollments.create(a, body);
  }

  @Roles('admin')
  @HttpCode(202)
  @Post('enrollments/simulate-scan')
  simulateScan(@CurrentAuth() a: AuthContext, @Body(new ZodPipe(scanBody)) body: z.infer<typeof scanBody>) {
    return this.enrollments.simulateScan(a, body.token);
  }
}
