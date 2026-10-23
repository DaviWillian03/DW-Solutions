import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { policySettingsSchema } from '@dw/contracts';
import { z } from 'zod';
import { CurrentAuth, Roles, type AuthContext } from '../auth/decorators.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { PoliciesService } from './policies.service.js';

const id = z.string().uuid();
const versionNumber = z.coerce.number().int().min(1).max(100_000);
const reason = z.string().trim().min(3).max(300);

const diffQuery = z.object({ from: versionNumber, to: versionNumber });
const previewBody = z.object({ settings: policySettingsSchema });
const versionBody = z.object({ baseVersion: versionNumber, settings: policySettingsSchema, note: reason });
const assignBody = z.object({
  deviceIds: z.array(z.string().uuid()).min(1).max(500),
  policyId: z.string().uuid().nullable(),
  reason,
});

@Controller()
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get('policies')
  list(@CurrentAuth() a: AuthContext) {
    return this.policies.list(a);
  }

  @Get('policies/:id')
  get(@CurrentAuth() a: AuthContext, @Param('id', new ZodPipe(id)) policyId: string) {
    return this.policies.get(a, policyId);
  }

  @Get('policies/:id/versions/:version')
  version(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ZodPipe(id)) policyId: string,
    @Param('version', new ZodPipe(versionNumber)) version: number,
  ) {
    return this.policies.version(a, policyId, version);
  }

  @Get('policies/:id/diff')
  diff(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ZodPipe(id)) policyId: string,
    @Query(new ZodPipe(diffQuery)) q: z.infer<typeof diffQuery>,
  ) {
    return this.policies.diff(a, policyId, q.from, q.to);
  }

  @Roles('admin')
  @HttpCode(200)
  @Post('policies/:id/preview')
  preview(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ZodPipe(id)) policyId: string,
    @Body(new ZodPipe(previewBody)) body: z.infer<typeof previewBody>,
  ) {
    return this.policies.preview(a, policyId, body.settings);
  }

  @Roles('admin')
  @Post('policies/:id/versions')
  createVersion(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ZodPipe(id)) policyId: string,
    @Body(new ZodPipe(versionBody)) body: z.infer<typeof versionBody>,
  ) {
    return this.policies.createVersion(a, policyId, body);
  }

  @Roles('admin')
  @HttpCode(200)
  @Post('devices/policy')
  assign(@CurrentAuth() a: AuthContext, @Body(new ZodPipe(assignBody)) body: z.infer<typeof assignBody>) {
    return this.policies.assign(a, body);
  }
}
