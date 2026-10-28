import { z } from 'zod';

export const citySchema = z.object({
  id: z.string().uuid('معرف المدينة يجب أن يكون بصيغة UUID صالحة'),
  nameAr: z.string().min(1, 'اسم المدينة بالعربية مطلوب'),
  nameEn: z.string().min(1, 'اسم المدينة بالإنجليزية مطلوب'),
  isActive: z.boolean().default(true),
  createdAt: z.union([z.string().datetime(), z.date()]).optional()
});

export const districtSchema = z.object({
  id: z.string().uuid('معرف الحي يجب أن يكون بصيغة UUID صالحة'),
  cityId: z.string().uuid('معرف المدينة التابع لها الحي يجب أن يكون بصيغة UUID صالحة'),
  nameAr: z.string().min(1, 'اسم الحي بالعربية مطلوب'),
  nameEn: z.string().min(1, 'اسم الحي بالإنجليزية مطلوب'),
  isActive: z.boolean().default(true),
  createdAt: z.union([z.string().datetime(), z.date()]).optional()
});

export const geoTreeItemSchema = citySchema.extend({
  districts: z.array(districtSchema)
});

export const geoTreeResponseSchema = z.array(geoTreeItemSchema);
