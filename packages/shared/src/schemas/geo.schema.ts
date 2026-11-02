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

export const createCitySchema = z.object({
  nameAr: z.string().min(2, 'اسم المدينة بالعربية يجب أن يتكون من حرفين على الأقل').max(100, 'اسم المدينة بالعربية يجب ألا يتجاوز 100 حرف'),
  nameEn: z.string().min(2, 'اسم المدينة بالإنجليزية يجب أن يتكون من حرفين على الأقل').max(100, 'اسم المدينة بالإنجليزية يجب ألا يتجاوز 100 حرف'),
  isActive: z.boolean().default(true)
});

export const updateCitySchema = z.object({
  nameAr: z.string().min(2, 'اسم المدينة بالعربية يجب أن يتكون من حرفين على الأقل').max(100, 'اسم المدينة بالعربية يجب ألا يتجاوز 100 حرف').optional(),
  nameEn: z.string().min(2, 'اسم المدينة بالإنجليزية يجب أن يتكون من حرفين على الأقل').max(100, 'اسم المدينة بالإنجليزية يجب ألا يتجاوز 100 حرف').optional(),
  isActive: z.boolean().optional()
});

export const createDistrictSchema = z.object({
  cityId: z.string().uuid('معرف المدينة يجب أن يكون بصيغة UUID صالحة'),
  nameAr: z.string().min(2, 'اسم الحي بالعربية يجب أن يتكون من حرفين على الأقل').max(100, 'اسم الحي بالعربية يجب ألا يتجاوز 100 حرف'),
  nameEn: z.string().min(2, 'اسم الحي بالإنجليزية يجب أن يتكون من حرفين على الأقل').max(100, 'اسم الحي بالإنجليزية يجب ألا يتجاوز 100 حرف'),
  isActive: z.boolean().default(true)
});

export const updateDistrictSchema = z.object({
  nameAr: z.string().min(2, 'اسم الحي بالعربية يجب أن يتكون من حرفين على الأقل').max(100, 'اسم الحي بالعربية يجب ألا يتجاوز 100 حرف').optional(),
  nameEn: z.string().min(2, 'اسم الحي بالإنجليزية يجب أن يتكون من حرفين على الأقل').max(100, 'اسم الحي بالإنجليزية يجب ألا يتجاوز 100 حرف').optional(),
  isActive: z.boolean().optional()
});

export const toggleGeoActiveSchema = z.object({
  isActive: z.boolean({ required_error: 'حالة التفعيل مطلوبة' })
});

export const adminGeoQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional()
});
