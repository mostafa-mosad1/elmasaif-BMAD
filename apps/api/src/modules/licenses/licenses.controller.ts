import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  SubmitFalLicenseInput,
  submitFalLicenseSchema,
} from '@elmasaif/shared';
import { LicensesService } from './licenses.service';

@ApiTags('Marketer Fal Licensing')
@Controller('users/fal-license')
@UseGuards(SessionAuthGuard)
@ApiBearerAuth()
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit Fal license credentials for administrative verification' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Fal license submitted successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid payload or past expiration date' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Fal license number already exists' })
  async submitFalLicense(
    @Req() req: any,
    @Body(new ZodValidationPipe(submitFalLicenseSchema)) body: SubmitFalLicenseInput,
  ) {
    return this.licensesService.submitFalLicense(req.user.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'Get current user Fal license and verification status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Fal license details retrieved successfully' })
  async getMyFalLicense(@Req() req: any) {
    return this.licensesService.getMyFalLicense(req.user.id);
  }
}

