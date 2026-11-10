import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    if (!this.schema || typeof this.schema.parse !== 'function') {
      return value;
    }

    try {
      return this.schema.parse(value);
    } catch (error: any) {
      if (error instanceof ZodError || error?.name === 'ZodError') {
        const issues = error.errors || error.issues || [];
        const firstMessage = issues[0]?.message || 'Validation failed';
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: firstMessage,
          details: typeof error.format === 'function' ? error.format() : { issues },
        });
      }
      throw new BadRequestException(error?.message || 'Validation failed');
    }
  }
}
