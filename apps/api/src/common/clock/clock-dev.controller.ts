import {
  Controller,
  Get,
  Post,
  Body,
  UsePipes,
  ForbiddenException,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import {
  CLOCK_MOCK_DISALLOWED_IN_PRODUCTION,
  ClockStatus,
  AdvanceClockDto,
  SetClockDto,
  advanceClockSchema,
  setClockSchema
} from '@elmasaif/shared';
import { ClockService } from './clock.service';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

@ApiTags('Development (Non-Production)')
@Controller('dev/clock')
export class ClockDevController {
  constructor(
    private readonly clockService: ClockService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get virtual clock status',
    description: 'Returns the current effective clock time, real system time, and active offset. Non-production only.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current clock status retrieved successfully'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Clock simulation endpoints are strictly forbidden in production'
  })
  async getClockStatus(): Promise<ClockStatus> {
    this.assertNotProduction();
    return this.clockService.getStatus();
  }

  @Post('advance')
  @ApiOperation({
    summary: 'Advance virtual clock',
    description: 'Advances the virtual clock forward by hours, minutes, seconds, or milliseconds. Non-production only.'
  })
  @UsePipes(new ZodValidationPipe(advanceClockSchema))
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Virtual clock advanced successfully'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Clock simulation endpoints are strictly forbidden in production'
  })
  async advanceClock(@Body() body: AdvanceClockDto): Promise<ClockStatus> {
    this.assertNotProduction();
    const totalMs =
      (body.hours ?? 0) * 3600000 +
      (body.minutes ?? 0) * 60000 +
      (body.seconds ?? 0) * 1000 +
      (body.ms ?? 0);

    this.clockService.advanceBy(totalMs);
    return this.clockService.getStatus();
  }

  @Post('set')
  @ApiOperation({
    summary: 'Set virtual clock to explicit date',
    description: 'Pins the virtual clock to a specific ISO 8601 date string. Non-production only.'
  })
  @UsePipes(new ZodValidationPipe(setClockSchema))
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Virtual clock pinned to specified timestamp'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Clock simulation endpoints are strictly forbidden in production'
  })
  async setClock(@Body() body: SetClockDto): Promise<ClockStatus> {
    this.assertNotProduction();
    this.clockService.setTime(body.isoDate);
    return this.clockService.getStatus();
  }

  @Post('reset')
  @ApiOperation({
    summary: 'Reset virtual clock',
    description: 'Resets virtual clock offset to 0, restoring real system time. Non-production only.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Virtual clock reset to real system time'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Clock simulation endpoints are strictly forbidden in production'
  })
  async resetClock(): Promise<ClockStatus> {
    this.assertNotProduction();
    this.clockService.reset();
    return this.clockService.getStatus();
  }

  private assertNotProduction(): void {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV;
    if (nodeEnv === 'production') {
      throw new ForbiddenException({
        code: CLOCK_MOCK_DISALLOWED_IN_PRODUCTION,
        message: 'Time manipulation endpoints are strictly forbidden in production'
      });
    }
  }
}
