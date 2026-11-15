import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExecutiveService } from './executive.service';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';

@ApiTags('Admin Executive Operations Dashboard')
@Controller('admin/executive')
@UseGuards(AdminSessionAuthGuard)
export class ExecutiveController {
  constructor(private readonly executiveService: ExecutiveService) {}

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get real-time executive operations dashboard metrics' })
  @ApiResponse({ status: 200, description: 'Executive dashboard metrics retrieved' })
  async getDashboard() {
    const data = await this.executiveService.getDashboardMetrics();
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع لوحة القيادة التنفيذية بنجاح',
      data,
    };
  }
}

