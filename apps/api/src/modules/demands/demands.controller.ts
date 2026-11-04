import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { DemandsService } from './demands.service';
import { CreateDemandDto, CancelDemandDto } from './dto/create-demand.dto';
import { DemandItem } from './dto/demand-item.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { RequireRole } from '../users/decorators/require-role.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  UserRole,
  createDemandSchema,
  CreateDemandInput,
  cancelDemandSchema,
  CancelDemandInput,
} from '@elmasaif/shared';

@ApiTags('Buyer Demands')
@Controller('demands')
export class DemandsController {
  constructor(private readonly demandsService: DemandsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.BUYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a structured property demand (FR-21, AD-9)' })
  @ApiBody({ type: CreateDemandDto })
  @ApiResponse({ status: 201, description: 'Demand created and immediately ACTIVE' })
  @ApiResponse({ status: 400, description: 'Validation error or inactive/unmatched geography' })
  @ApiResponse({ status: 403, description: 'Buyer profile inactive or unauthorized' })
  async createDemand(
    @Req() req: any,
    @Body(new ZodValidationPipe(createDemandSchema)) dto: CreateDemandInput,
  ) {
    const data = await this.demandsService.createDemand(
      req.user.id,
      req.user.activeRole || req.user.role,
      dto,
    );
    return {
      statusCode: HttpStatus.CREATED,
      data,
    };
  }

  // Static route must stay declared ahead of any ':id' route (NestJS route order).
  @Get('my')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List the authenticated buyer's demands — active and historical (FR-58)",
  })
  async getMyDemands(@Req() req: any) {
    const data = await this.demandsService.getBuyerDemands(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel an ACTIVE/MATCHED demand with a structured reason (FR-58)',
  })
  @ApiBody({ type: CancelDemandDto })
  @ApiResponse({ status: 200, description: 'Demand cancelled and audited' })
  @ApiResponse({ status: 404, description: 'Demand not found for this buyer' })
  @ApiResponse({ status: 409, description: 'Demand is not in a cancellable state' })
  async cancelDemand(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
    @Body(new ZodValidationPipe(cancelDemandSchema)) dto: CancelDemandInput,
  ) {
    const data: DemandItem = await this.demandsService.cancelDemand(
      req.user.id,
      id,
      dto.reason,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إلغاء طلب الشراء بنجاح',
      data,
    };
  }
}
