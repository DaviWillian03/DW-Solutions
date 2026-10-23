import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/** Valida o corpo/parâmetros com Zod e devolve erros por campo, sem ecoar valores enviados. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: 'Dados inválidos.',
        fields: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    return parsed.data;
  }
}
