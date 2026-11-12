import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  ApproveFalLicenseInput,
  approveFalLicenseSchema,
  ForceUnlockFalLicenseInput,
  forceUnlockFalLicenseSchema,
  LicensingQueueQuery,
  licensingQueueQuerySchema,
  parseIfMatchVersion,
  RejectFalLicenseInput,
  rejectFalLicenseSchema,
} from '@elmasaif/shared';
import { AdminLicensesService } from './admin-licenses.service';

@ApiTags('Admin Fal Licensing Moderation Queue')
@ApiBearerAuth()
@Controller(['admin/licenses', 'admin/fal-profiles'])
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminLicensesController {
  constructor(private readonly adminLicensesService: AdminLicensesService) {}

  @Get()
  @RequireAdminPermission('Licenses.Review')
  @ApiOperation({ summary: 'Get paginated licensing applications queue' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Queue retrieved successfully' })
  async getLicensingQueue(
    @Req() req: any,
    @Query(new ZodValidationPipe(licensingQueueQuerySchema)) query: LicensingQueueQuery,
  ) {
    return this.adminLicensesService.getLicensingQueue(query, req.admin.id);
  }

  @Get(':id')
  @RequireAdminPermission('Licenses.Review')
  @ApiOperation({ summary: 'Get full license application details with presigned document URLs' })
  @ApiParam({ name: 'id', description: 'Fal license application ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'License details retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'License not found' })
  async getLicenseDetail(@Req() req: any, @Param('id') id: string) {
    return this.adminLicensesService.getLicenseDetail(id, req.admin.id);
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Licenses.Review')
  @ApiOperation({ summary: 'Claim exclusive 15-minute lease on a license application' })
  @ApiParam({ name: 'id', description: 'Fal license application ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Claim lease acquired' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'License locked by another administrator' })
  async claimLicense(@Req() req: any, @Param('id') id: string) {
    return this.adminLicensesService.claimLicense(id, req.admin);
  }

  @Post(':id/heartbeat')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Licenses.Review')
  @ApiOperation({ summary: 'Renew 15-minute claim lease (heartbeat)' })
  @ApiParam({ name: 'id', description: 'Fal license application ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Heartbeat acknowledged and lease extended' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Lease expired or not held by caller' })
  async heartbeatLicenseLock(@Req() req: any, @Param('id') id: string) {
    return this.adminLicensesService.heartbeatLicenseLock(id, req.admin);
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Licenses.Review')
  @ApiOperation({ summary: 'Explicitly release held claim lease' })
  @ApiParam({ name: 'id', description: 'Fal license application ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lease released successfully' })
  async releaseLicenseLock(@Req() req: any, @Param('id') id: string) {
    return this.adminLicensesService.releaseLicenseLock(id, req.admin);
  }

  @Post(':id/force-unlock')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Tasks.ForceUnlock')
  @ApiOperation({ summary: 'Super Admin override to force-unlock a claim lease' })
  @ApiParam({ name: 'id', description: 'Fal license application ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lock cleared and audited' })
  async forceUnlockLicense(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(forceUnlockFalLicenseSchema)) body: ForceUnlockFalLicenseInput,
  ) {
    return this.adminLicensesService.forceUnlockLicense(id, req.admin, body);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Licenses.Review', 'Licenses.Verify')
  @ApiOperation({ summary: 'Approve Fal license and activate marketer profile' })
  @ApiParam({ name: 'id', description: 'Fal license application ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'License approved and marketer activated' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Lock required or version conflict' })
  async approveLicense(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(approveFalLicenseSchema)) body: ApproveFalLicenseInput,
    @Headers('if-match') ifMatch?: string,
  ) {
    const effectiveVersion = parseIfMatchVersion(ifMatch, body.version) ?? body.version;
    return this.adminLicensesService.approveLicense(id, req.admin, {
      ...body,
      version: effectiveVersion,
    });
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Licenses.Review', 'Licenses.Verify')
  @ApiOperation({ summary: 'Reject Fal license application with required feedback' })
  @ApiParam({ name: 'id', description: 'Fal license application ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'License rejected and feedback recorded' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Rejection reason under 10 chars' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Lock required or version conflict' })
  async rejectLicense(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectFalLicenseSchema)) body: RejectFalLicenseInput,
    @Headers('if-match') ifMatch?: string,
  ) {
    const effectiveVersion = parseIfMatchVersion(ifMatch, body.version) ?? body.version;
    return this.adminLicensesService.rejectLicense(id, req.admin, {
      ...body,
      version: effectiveVersion,
    });
  }
}

