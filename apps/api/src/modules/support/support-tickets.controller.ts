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
  CreateSupportTicketInput,
  createSupportTicketSchema,
  SESSION_COOKIE_NAME,
} from '@elmasaif/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SupportTicketsService } from './support-tickets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';

@ApiTags('Support Tickets (User / Customer)')
@Controller('support/tickets')
export class SupportTicketsController {
  constructor(
    private readonly supportTicketsService: SupportTicketsService,
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Open a new support ticket with deterministic SLA tracking (FR-38)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Ticket opened successfully',
  })
  async createTicket(
    @Req() req: any,
    @Body(new ZodValidationPipe(createSupportTicketSchema))
    body: CreateSupportTicketInput,
  ) {
    let userId: string | undefined;

    const token =
      req.cookies?.[SESSION_COOKIE_NAME] ||
      req.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (token) {
      const session = await this.prisma.session.findUnique({
        where: { token },
        select: { userId: true, expiresAt: true },
      });
      if (session && session.expiresAt > this.clockService.now()) {
        userId = session.userId;
      }
    }

    const result = await this.supportTicketsService.createTicket(body, userId);

    return {
      statusCode: HttpStatus.CREATED,
      message: result.message,
      data: result,
      requestId: req.headers?.['x-request-id'],
    };
  }
}

