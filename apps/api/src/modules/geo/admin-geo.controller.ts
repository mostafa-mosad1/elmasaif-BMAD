import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { GeoService } from './geo.service';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createCitySchema,
  CreateCityInput,
  updateCitySchema,
  UpdateCityInput,
  createDistrictSchema,
  CreateDistrictInput,
  updateDistrictSchema,
  UpdateDistrictInput,
  AdminRole,
  AUTH_NOT_AUTHORIZED
} from '@elmasaif/shared';

@Injectable()
export class AdminGeoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const admin = request.admin;

    if (!admin?.id || !admin.isActive || admin.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException({
        code: AUTH_NOT_AUTHORIZED,
        message: 'الدور الإداري لا يملك الصلاحية المطلوبة لإدارة البيانات الجغرافية'
      });
    }

    return true;
  }
}

@ApiTags('Admin Geographic Management')
@ApiBearerAuth()
@Controller('admin/geo')
@UseGuards(AdminSessionAuthGuard, AdminGeoGuard)
export class AdminGeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('cities')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all cities for administrative management',
    description: 'Retrieves all Saudi cities with active/inactive status and district counts'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of cities retrieved successfully'
  })
  async getCities() {
    return this.geoService.adminGetCities();
  }

  @Post('cities')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new city',
    description: 'Creates a new Saudi city and writes an immutable entry to AuditLog'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'City created successfully'
  })
  async createCity(
    @Body(new ZodValidationPipe(createCitySchema)) body: CreateCityInput,
    @Req() req: any
  ) {
    const admin = req.admin;
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    return this.geoService.adminCreateCity(body, admin.id, ip);
  }

  @Patch('cities/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update city details or active status',
    description: 'Updates a city and writes an immutable entry to AuditLog'
  })
  @ApiParam({ name: 'id', description: 'UUID of the city' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'City updated successfully'
  })
  async updateCity(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCitySchema)) body: UpdateCityInput,
    @Req() req: any
  ) {
    const admin = req.admin;
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    return this.geoService.adminUpdateCity(id, body, admin.id, ip);
  }

  @Get('cities/:cityId/districts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all districts for a city',
    description: 'Retrieves all districts (both active and inactive) belonging to the specified city'
  })
  @ApiParam({ name: 'cityId', description: 'UUID of the city' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Districts retrieved successfully'
  })
  async getDistrictsByCity(@Param('cityId') cityId: string) {
    return this.geoService.adminGetDistrictsByCity(cityId);
  }

  @Post('districts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new district',
    description: 'Creates a new district bound to a city and writes an immutable entry to AuditLog'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'District created successfully'
  })
  async createDistrict(
    @Body(new ZodValidationPipe(createDistrictSchema)) body: CreateDistrictInput,
    @Req() req: any
  ) {
    const admin = req.admin;
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    return this.geoService.adminCreateDistrict(body, admin.id, ip);
  }

  @Patch('districts/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update district details or active status',
    description: 'Updates a district and writes an immutable entry to AuditLog'
  })
  @ApiParam({ name: 'id', description: 'UUID of the district' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'District updated successfully'
  })
  async updateDistrict(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDistrictSchema)) body: UpdateDistrictInput,
    @Req() req: any
  ) {
    const admin = req.admin;
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    return this.geoService.adminUpdateDistrict(id, body, admin.id, ip);
  }
}

