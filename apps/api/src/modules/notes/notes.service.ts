import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  NoteEntityType,
  CreateInternalNoteInput,
  OperationalInternalNoteDto,
  AUDIT_ACTION_INTERNAL_NOTE_CREATED,
} from '@elmasaif/shared';

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly clockService: ClockService,
  ) {}

  async getNotesByEntity(
    entityType: NoteEntityType,
    entityId: string,
  ): Promise<OperationalInternalNoteDto[]> {
    const notes = await this.prisma.operationalInternalNote.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        authorAdmin: {
          select: {
            fullName: true,
            role: true,
          },
        },
      },
    });

    return notes.map((n) => this.mapToDto(n));
  }

  async createNote(
    adminId: string,
    input: CreateInternalNoteInput,
  ): Promise<OperationalInternalNoteDto> {
    const note = await this.prisma.operationalInternalNote.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        content: input.content,
        authorAdminId: adminId,
      },
      include: {
        authorAdmin: {
          select: {
            fullName: true,
            role: true,
          },
        },
      },
    });

    await this.auditService.record(this.prisma, {
      actorId: adminId,
      actorType: 'ADMIN',
      action: AUDIT_ACTION_INTERNAL_NOTE_CREATED,
      entityType: input.entityType,
      entityId: input.entityId,
      justificationReason: 'إضافة ملاحظة إدارية داخلية',
      metadata: {
        noteId: note.id,
        contentLength: input.content.length,
      },
    });

    return this.mapToDto(note);
  }

  private mapToDto(note: any): OperationalInternalNoteDto {
    return {
      id: note.id,
      entityType: note.entityType as NoteEntityType,
      entityId: note.entityId,
      content: note.content,
      authorAdminId: note.authorAdminId,
      authorAdminName: note.authorAdmin?.fullName || 'مشرف غير محدد',
      authorAdminRole: note.authorAdmin?.role || 'ADMIN',
      createdAt: note.createdAt?.toISOString?.() ?? String(note.createdAt),
      updatedAt: note.updatedAt?.toISOString?.() ?? String(note.updatedAt),
    };
  }
}

