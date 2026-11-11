import { Controller, Get, Param, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { BrokersService } from './brokers.service';

/**
 * Story 6.5 / FR-19, UC-30: Public Broker Profile & Moderated Reviews Controller.
 * Publicly accessible without authentication.
 */
@ApiTags('Brokers')
@Controller('brokers')
export class BrokersController {
  constructor(private readonly brokersService: BrokersService) {}

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get public broker profile by profile ID or user ID (FR-19, BR-06)',
    description:
      'Returns marketer profile header, verified Fal status, ratings breakdown, masked reviews feed, and active listings. Strictly conceals phone and email.',
  })
  @ApiParam({ name: 'id', description: 'Broker profile UUID or User UUID' })
  @ApiResponse({ status: 200, description: 'Broker profile returned' })
  @ApiResponse({ status: 404, description: 'BROKER_NOT_FOUND' })
  async getPublicProfile(@Param('id') id: string) {
    const data = await this.brokersService.getBrokerPublicProfile(id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }
}

