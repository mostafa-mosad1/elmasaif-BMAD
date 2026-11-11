import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ContractTemplatesService } from './contract-templates.service';

@ApiTags('Admin Contract Templates')
@ApiBearerAuth()
@Controller('admin/contract-templates')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminContractTemplatesController {
  constructor(private readonly templatesService: ContractTemplatesService) {}

  @Get()
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'List all active contract templates for dispatch' })
  @ApiResponse({ status: 200, description: 'Active contract templates list' })
  async getActiveTemplates() {
    return this.templatesService.getActiveTemplates();
  }
}

