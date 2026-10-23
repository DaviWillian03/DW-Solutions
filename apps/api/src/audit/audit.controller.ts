import { Controller, Get, Query } from '@nestjs/common';
import { AUDIT_GROUPS } from '@dw/contracts';
import { z } from 'zod';
import { CurrentAuth, Roles, type AuthContext } from '../auth/decorators.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { AuditService } from './audit.service.js';

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'data inválida (AAAA-MM-DD)')
  .transform((d) => new Date(`${d}T00:00:00-03:00`));

const listQuery = z.object({
  group: z.enum(Object.keys(AUDIT_GROUPS) as [string, ...string[]]).optional(),
  outcome: z.enum(['success', 'denied', 'failure']).optional(),
  actorId: z.string().max(64).optional(),
  targetId: z.string().max(64).optional(),
  search: z.string().trim().max(80).optional(),
  from: day.optional(),
  // “até” inclui o dia inteiro.
  to: day.transform((d) => new Date(d.getTime() + 86_400_000)).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(50),
});

/** Auditoria (M11). Só administradores: os registros têm IP e dados de acesso de outras pessoas. */
@Roles('admin')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@CurrentAuth() a: AuthContext, @Query(new ZodPipe(listQuery)) q: z.infer<typeof listQuery>) {
    return this.audit.list(a, q as Parameters<AuditService['list']>[1]);
  }

  @Get('verify')
  verify(@CurrentAuth() a: AuthContext) {
    return this.audit.verify(a);
  }
}
