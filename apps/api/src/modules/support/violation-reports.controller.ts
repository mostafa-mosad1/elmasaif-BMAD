import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateViolationReportInput,
  createViolationReportSchema,
  SESSION_COOKIE_NAME,
} from '@elmasaif/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ViolationReportsService } from './violation-reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';

@ApiTags('Violation Reports (Public & Authenticated)')
@Controller('reports')
export class ViolationReportsController {
  constructor(
    private readonly violationReportsService: ViolationReportsService,
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a new violation report on a listing, broker, or user (FR-37)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Report submitted successfully',
  })
  async createReport(
    @Req() req: any,
    @Body(new ZodValidationPipe(createViolationReportSchema))
    body: CreateViolationReportInput,
  ) {
    let reporterUserId: string | undefined;

    // Check optional authenticated user session
    const token =
      req.cookies?.[SESSION_COOKIE_NAME] ||
      req.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (token) {
      const session = await this.prisma.session.findUnique({
        where: { token },
        select: { userId: true, expiresAt: true },
      });
      if (session && session.expiresAt > this.clockService.now()) {
        reporterUserId = session.userId;
      }
    }

    const ipAddress =
      req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress;

    const result = await this.violationReportsService.createReport(
      body,
      reporterUserId,
    );

    return {
      statusCode: HttpStatus.CREATED,
      message: result.message,
      data: result,
      requestId: req.headers?.['x-request-id'],
    };
  }
}

