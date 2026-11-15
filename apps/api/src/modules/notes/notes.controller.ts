import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NotesService } from './notes.service';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createInternalNoteSchema,
  CreateInternalNoteInput,
  NoteEntityType,
} from '@elmasaif/shared';

@ApiTags('Admin Operational Internal Staff Notes')
@Controller('admin/notes')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
@RequireAdminPermission('Notes.Manage')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get internal staff notes for an entity (AdminOnly)' })
  @ApiResponse({ status: 200, description: 'Internal staff notes retrieved' })
  async getNotes(
    @Query('entityType') entityType: NoteEntityType,
    @Query('entityId') entityId: string,
  ) {
    if (!entityType || !entityId) {
      throw new BadRequestException('يجب تحديد نوع ومعرف الكيان المطلوب');
    }

    const data = await this.notesService.getNotesByEntity(entityType, entityId);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع الملاحظات الداخلية بنجاح',
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create private internal staff note for an entity' })
  @ApiResponse({ status: 201, description: 'Internal staff note created' })
  async createNote(
    @Body(new ZodValidationPipe(createInternalNoteSchema)) body: CreateInternalNoteInput,
    @Req() req: any,
  ) {
    const data = await this.notesService.createNote(req.admin.id, body);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'تم حفظ الملاحظة الداخلية بنجاح',
      data,
    };
  }
}

