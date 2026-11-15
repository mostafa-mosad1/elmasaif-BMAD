import { z } from 'zod';
import { NoteEntityType } from '../enums/notes';
import { createInternalNoteSchema } from '../schemas/notes.schema';

export type CreateInternalNoteInput = z.infer<typeof createInternalNoteSchema>;

export interface OperationalInternalNoteDto {
  id: string;
  entityType: NoteEntityType;
  entityId: string;
  content: string;
  authorAdminId: string;
  authorAdminName: string;
  authorAdminRole: string;
  createdAt: string;
  updatedAt: string;
}

