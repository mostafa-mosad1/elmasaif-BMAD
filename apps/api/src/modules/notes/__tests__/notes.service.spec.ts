import { Test, TestingModule } from '@nestjs/testing';
import { NotesService } from '../notes.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ClockService } from '../../../common/clock/clock.service';
import { NoteEntityType, AUDIT_ACTION_INTERNAL_NOTE_CREATED } from '@elmasaif/shared';

describe('NotesService', () => {
  let service: NotesService;
  let prisma: any;
  let auditService: any;
  let clockService: any;

  const mockAdminId = 'adm-00000000-0000-0000-0000-000000000001';
  const mockEntityId = 'ent-00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    prisma = {
      operationalInternalNote: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    auditService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    clockService = {
      now: jest.fn().mockReturnValue(new Date('2026-11-15T12:00:00.000Z')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNote', () => {
    it('should create an internal note bound to admin and write audit log', async () => {
      prisma.operationalInternalNote.create.mockResolvedValueOnce({
        id: 'note-1',
        entityType: NoteEntityType.LISTING,
        entityId: mockEntityId,
        content: 'ملاحظة تدقيق لصك الملكية العقارية',
        authorAdminId: mockAdminId,
        authorAdmin: {
          fullName: 'أحمد المشرف',
          role: 'MODERATOR',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const note = await service.createNote(mockAdminId, {
        entityType: NoteEntityType.LISTING,
        entityId: mockEntityId,
        content: 'ملاحظة تدقيق لصك الملكية العقارية',
      });

      expect(note.id).toBe('note-1');
      expect(note.authorAdminName).toBe('أحمد المشرف');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: AUDIT_ACTION_INTERNAL_NOTE_CREATED,
          entityType: 'LISTING',
          entityId: mockEntityId,
        }),
      );
    });
  });

  describe('getNotesByEntity', () => {
    it('should return notes ordered by createdAt descending with author info', async () => {
      prisma.operationalInternalNote.findMany.mockResolvedValueOnce([
        {
          id: 'note-1',
          entityType: NoteEntityType.DEAL,
          entityId: mockEntityId,
          content: 'تم التحقق من الحوالة البنكية',
          authorAdminId: mockAdminId,
          authorAdmin: {
            fullName: 'سعد المدقق',
            role: 'FINANCIAL_AUDITOR',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const notes = await service.getNotesByEntity(NoteEntityType.DEAL, mockEntityId);
      expect(notes.length).toBe(1);
      expect(notes[0].content).toBe('تم التحقق من الحوالة البنكية');
      expect(notes[0].authorAdminRole).toBe('FINANCIAL_AUDITOR');
    });
  });
});

