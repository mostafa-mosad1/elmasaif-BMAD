import { z } from 'zod';
import { PropertyType } from '../enums';

export const financialReportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  propertyType: z.nativeEnum(PropertyType).optional(),
  cityId: z.string().uuid().optional(),
  marketerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

