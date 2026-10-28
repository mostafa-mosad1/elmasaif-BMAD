import {
  Controller,
  Get,
  Param,
  Query,
  HttpStatus
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam
} from '@nestjs/swagger';
import { GeoService } from './geo.service';

@ApiTags('Geography')
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('cities')
  @ApiOperation({
    summary: 'List active Saudi cities',
    description: 'Retrieves all active Saudi cities sorted alphabetically by Arabic name. Pass includeInactive=true for administrative views.'
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'When true, includes inactive cities'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of cities retrieved successfully'
  })
  async getCities(@Query('includeInactive') includeInactive?: string) {
    const shouldInclude = includeInactive === 'true' || includeInactive === '1';
    return this.geoService.getCities(shouldInclude);
  }

  @Get('cities/:cityId/districts')
  @ApiOperation({
    summary: 'List districts by city',
    description: 'Retrieves active districts for the specified city ID sorted by Arabic name.'
  })
  @ApiParam({
    name: 'cityId',
    type: String,
    description: 'UUID of the city'
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'When true, includes inactive districts'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of districts for the city retrieved successfully'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'City not found or invalid UUID format'
  })
  async getDistrictsByCity(
    @Param('cityId') cityId: string,
    @Query('includeInactive') includeInactive?: string
  ) {
    const shouldInclude = includeInactive === 'true' || includeInactive === '1';
    return this.geoService.getDistrictsByCity(cityId, shouldInclude);
  }

  @Get('tree')
  @ApiOperation({
    summary: 'Hierarchical geographic tree',
    description: 'Retrieves the complete cascading tree of active cities and their nested active districts for frontend dropdowns (UX-DR14).'
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'When true, includes inactive cities and districts'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Hierarchical geographic tree retrieved successfully'
  })
  async getGeoTree(@Query('includeInactive') includeInactive?: string) {
    const shouldInclude = includeInactive === 'true' || includeInactive === '1';
    return this.geoService.getGeoTree(shouldInclude);
  }
}
