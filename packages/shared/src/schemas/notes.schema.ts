import { z } from 'zod';
import { NoteEntityType } from '../enums/notes';

export const createInternalNoteSchema = z.object({
  entityType: z.nativeEnum(NoteEntityType),
  entityId: z.string().uuid('معرف الكيان غير صحيح'),
  content: z
    .string()
    .trim()
    .min(1, 'محتوى الملاحظة مطلوب')
    .max(1000, 'محتوى الملاحظة يجب ألا يتجاوز 1000 حرف'),
});

